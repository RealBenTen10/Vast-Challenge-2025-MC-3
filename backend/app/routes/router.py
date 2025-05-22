import random
from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, JSONResponse
from typing import Optional, List, Dict, Any
from neo4j import GraphDatabase
import os
import time
import pandas as pd
from fastapi import BackgroundTasks
import json
from collections import defaultdict

# Credentials
NEO4J_URI = "bolt://" + os.environ.get('DB_HOST') + ":7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = os.environ.get('DB_PASSWORD')

router = APIRouter()

# Root endpoint
# This is the root endpoint for the FastAPI application.
# It returns a simple HTML page with the title "AVA Template Python API".
@router.get("/", response_class=HTMLResponse, tags=["ROOT"])
async def root():
    html_content = """
        <html>
            <head>
                <title>AVA Template Python API</title>
            </head>
            <body>
                <h1>AVA Template Python API</h1>
            </body>
        </html>
        """
    return HTMLResponse(content=html_content, status_code=200)
# Just used for debugging

# Clrear the database
# This endpoint clears the Neo4j database by deleting all nodes and relationships.
@router.get("/clear-db", response_class=JSONResponse)
async def clear_db():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
        print("Database cleared.")
    print("Database cleared.")
    return {"success": True}

# Load graph from JSON
# This endpoint loads graph data from a JSON file into the Neo4j database.
# It uses a background task to perform the loading operation.
@router.get("/load-graph-json", response_class=JSONResponse)
async def load_graph_json(background_tasks: BackgroundTasks):
    background_tasks.add_task(load_graph_json)
    return {"success": True, "message": "Graph loading started in background."}
# This function loads graph data from a JSON file into the Neo4j database.
# It reads the data and schema from the specified JSON files, clears the database,
# and then creates nodes and edges based on the data.
# It is called in the background when the /load-graph-json endpoint is accessed.
async def load_graph_json():
    print("Loading graph data from JSON...")
    data_path = "MC3_graph.json"
    schema_path = "MC3_schema.json"

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)["schema"]

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    def create_node(tx, node):
        node_type = node.get("type")
        if node_type not in ["Entity", "Event", "Relationship"]:
            return  # skip unknown types

        props = {k: v for k, v in node.items() if k != "type"}
        props["type"] = node_type
        set_clause = ", ".join([f'n.{k} = ${k}' for k in props.keys()])

        query = f"""
            MERGE (n:{node_type} {{id: $id}})
            SET {set_clause}
        """
        tx.run(query, **props)

    def create_edge(tx, edge):
        source_id = edge.get("source")
        target_id = edge.get("target")
        rel_type = edge.get("type", "RELATED_TO")  # default fallback
        edge_id = edge.get("id")

        props = {k: v for k, v in edge.items() if k not in ["source", "target"]}
        set_clause = ", ".join([f"r.{k} = ${k}" for k in props.keys()])
        set_clause = f"SET {set_clause}" if set_clause else ""

        tx.run(f"""
            MATCH (a {{id: $source_id}}), (b {{id: $target_id}})
            MERGE (a)-[r:`{rel_type}`]->(b)
            {set_clause}
        """, source_id=source_id, target_id=target_id, **props)

    with driver.session() as session:
        # Clear DB
        session.run("MATCH (n) DETACH DELETE n")

        # Load nodes
        for node in data.get("nodes", []):
            session.write_transaction(create_node, node)

        # Load edges
        for edge in data.get("edges", []):
            if "source" in edge and "target" in edge:
                session.write_transaction(create_edge, edge)
    print("Graph loaded successfully.")
    await flatten_communication_events()
    return {"success": True, "message": "All nodes and edges loaded."}

# Flatten communication events
# This endpoint flattens communication events in the Neo4j database.
# It retrieves communication events, their metadata, and creates new relationships
async def flatten_communication_events():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    print("Flattening communication events...")

    with driver.session() as session:
        # Step 1: Find all Communication events and their metadata
        result = session.run("""
            MATCH (c:Event {sub_type: "Communication"})
            RETURN c.id AS comm_id, c.timestamp AS timestamp, c.content AS content
        """)
        communications = [r.data() for r in result]

        for comm in communications:
            comm_id = comm["comm_id"]
            timestamp = comm.get("timestamp")
            content = comm.get("content")

            # Step 2: Get all entities connected TO the communication event
            entity_result = session.run("""
                MATCH (e:Entity)-[:sent]->(c:Event {id: $comm_id})
                RETURN e.id AS entity_id
            """, comm_id=comm_id)
            entity_ids = [r["entity_id"] for r in entity_result]

            # Step 3: Get all targets connected FROM the communication event
            target_result = session.run("""
                MATCH (c:Event {id: $comm_id})-[:evidence_for]->(t)
                RETURN t.id AS target_id
            """, comm_id=comm_id)
            target_ids = [r["target_id"] for r in target_result]

            # Step 4: Create new relationships from entity to target, with metadata
            for entity_id in entity_ids:
                for target_id in target_ids:
                    session.run("""
                        MATCH (e:Entity {id: $entity_id}), (t {id: $target_id})
                        MERGE (e)-[r:communication_links {comm_id: $comm_id}]->(t)
                        SET r.timestamp = $timestamp,
                            r.content = $content
                    """, entity_id=entity_id, target_id=target_id,
                         comm_id=comm_id, timestamp=timestamp, content=content)

            # Step 5: Remove the original communication node
            session.run("""
                MATCH (c:Event {id: $comm_id})
                DETACH DELETE c
            """, comm_id=comm_id)
    print("Flattening completed.")
    await combine_communication_links()
    return {
        "success": True,
        "message": f"Flattened {len(communications)} Communication events and preserved metadata in new relationships."
    }

# Combine communication links
# This endpoint combines communication links in the Neo4j database.
# It merges multiple communication links between the same entity-target pair into a single link.
async def combine_communication_links():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    print("Combining communication links...")

    with driver.session() as session:
        # Step 1: Find all unique (entity → target) communication link pairs
        pairs = session.run("""
            MATCH (e:Entity)-[r:communication_links]->(t)
            RETURN e.id AS source_id, t.id AS target_id,
                   collect(r.comm_id) AS comm_ids,
                   collect(r.timestamp) AS timestamps,
                   collect(r.content) AS contents
        """)

        for record in pairs:
            source_id = record["source_id"]
            target_id = record["target_id"]
            comm_ids = record["comm_ids"]
            timestamps = record["timestamps"]
            contents = record["contents"]

            # Step 2: Delete old relationships between the same pair
            session.run("""
                MATCH (e:Entity {id: $source_id})-[r:communication_links]->(t {id: $target_id})
                DELETE r
            """, source_id=source_id, target_id=target_id)

            # Step 3: Create a single relationship with merged metadata
            session.run("""
                MATCH (e:Entity {id: $source_id}), (t {id: $target_id})
                MERGE (e)-[r:communication_links]->(t)
                SET r.comm_ids = $comm_ids,
                    r.timestamps = $timestamps,
                    r.contents = $contents
            """, source_id=source_id, target_id=target_id,
                 comm_ids=comm_ids, timestamps=timestamps, contents=contents)
    print("Combining completed.")
    await remove_non_communication_links()
    return {
        "success": True,
        "message": "All communication_links combined per entity-target pair"
    }

# Remove non-communication links
# This endpoint removes non-communication links from the Neo4j database.
# It deletes all relationships that are not of type "communication_links" between entities.
async def remove_non_communication_links():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    print("Removing non-communication links...")
    with driver.session() as session:
        session.run("""
            MATCH (e:Entity)-[:communication_links]->(t)
            WITH e, t
            MATCH (e)-[r]->(t)
            WHERE type(r) <> 'communication_links'
            DELETE r
        """)
    print("Removing completed.")
    print("Successfully loaded graph data into Neo4j.")
    return {
        "success": True,
        "message": "Removed all redundant non-communication links from Entity"
    }

# Collpase relationships
# This endpoint collapses relationships in the Neo4j database.
# It deletes all relationships of type "related_to" and "evidence_for" between entities
# and creates new relationship edges between them.
@router.get("/collapse-relationship", response_class=JSONResponse)
async def collapse_relationships():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    print("Collapsing relationships...")

    with driver.session() as session:
        # Step 1: Find all Relationship nodes
        result = session.run("""
            MATCH (r:Relationship)
            RETURN r.id AS rel_id, r.sub_type AS sub_type, properties(r) AS props
        """)
        relationships = result.data()

        for rel in relationships:
            rel_id = rel["rel_id"]
            sub_type = rel.get("sub_type", "related_to")
            properties = rel.get("props", {})

            # Step 2: Find connected entities
            entity_pair = session.run("""
                MATCH (a:Entity)-[:related_to|evidence_for]->(r:Relationship {id: $rel_id})<-[:related_to|evidence_for]-(b:Entity)
                RETURN a.id AS source_id, b.id AS target_id
                LIMIT 1
            """, rel_id=rel_id).single()

            if entity_pair:
                source_id = entity_pair["source_id"]
                target_id = entity_pair["target_id"]

                # Step 3: Create new edge with metadata
                set_clause = ", ".join([f"r.{k} = ${k}" for k in properties.keys()])
                set_clause = f"SET {set_clause}" if set_clause else ""

                session.run(f"""
                    MATCH (a:Entity {{id: $source_id}}), (b:Entity {{id: $target_id}})
                    MERGE (a)-[r:collapsed_relationship]->(b)
                    SET r.rel_id = $rel_id,
                        r.sub_type = $sub_type
                    {"," if set_clause else ""} {set_clause}
                """, source_id=source_id, target_id=target_id, rel_id=rel_id, sub_type=sub_type, **properties)

            # Step 4: Delete the original relationship node
            session.run("""
                MATCH (r:Relationship {id: $rel_id})
                DETACH DELETE r
            """, rel_id=rel_id)

    print(f"Collapsed {len(relationships)} Relationship nodes into edges.")
    return {
        "success": True,
        "message": f"Collapsed {len(relationships)} Relationship nodes into edges."
    }

    
async def collapse_relationships():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    print("Collapsing relationships...")
    with driver.session() as session:
        session.run("""
            MATCH (a)-[r]->(b)
            WHERE type(r) IN ['related_to', 'evidence_for']
            DELETE r
        """)
    print("Collapsing completed.")
    return {
        "success": True,
        "message": "Collapsed all relationships"
    }

# Entity event counts
# This endpoint retrieves the count of events associated with each entity in the Neo4j database.
# It returns a JSON response with the entity IDs and their corresponding event counts.
@router.get("/entity-event-counts", response_class=JSONResponse)
async def get_entity_event_counts():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    with driver.session() as session:
        result = session.run("""
            MATCH (e:Entity)<--(ev:Event)
            RETURN e.id AS entity_id, count(ev) AS event_count
        """)
        data = [{"entity": r["entity_id"], "count": r["event_count"]} for r in result]
        return {"success": True, "data": data}

# Read DB graph
# This endpoint reads the graph data from the Neo4j database.
# It retrieves nodes and edges, categorizes them into different types, and returns them in a JSON response.
@router.get("/read-db-graph", response_class=JSONResponse)
async def read_db_graph():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    print("Reading graph data from Neo4j...")
    with driver.session() as session:
        result_nodes = session.run("MATCH (n) RETURN n.id AS id, labels(n) AS labels, n.sub_type AS sub_type")
        nodes = []
        for r in result_nodes:
            node_type = "Unknown"
            labels = r["labels"]
            if "Entity" in labels:
                node_type = "Entity"
            elif "Event" in labels:
                node_type = "Event"
            elif "Relationship" in labels:
                node_type = "Relationship"
            nodes.append({
                "id": r["id"],
                "label": r.get("sub_type"),
                "type": node_type,
            })

        result_edges = session.run("""
            MATCH (a)-[r]->(b)
            RETURN a.id AS source, b.id AS target, type(r) AS type
        """)
        links = [{"source": r["source"], "target": r["target"], "type": r["type"]} for r in result_edges]
    print("Graph data read successfully.")
    return {"success": True, "nodes": nodes, "links": links}


# Aggregate entity interactions
# This endpoint aggregates interactions between entities in the Neo4j database.
# It combines events and relationships into a single representation for each entity pair.
# It is not used in the current code but is defined for potential future use.
def aggregate_entity_interactions(nodes: List[Dict[str, Any]], links: List[Dict[str, Any]]) -> Dict[str, Any]:
    print("Aggregating entity interactions...")
    aggregated_links: List[Dict[str, Any]] = []
    node_map: Dict[str, Dict[str, Any]] = {node["id"]: node for node in nodes}
    processed_pairs = set()  # To keep track of processed entity pairs

    # Group events and relationships by source-target pairs
    grouped_interactions = defaultdict(lambda: {"events": [], "relationships": []})

    for link in links:
        source_id = link["source"]
        target_id = link["target"]
        source_node = node_map.get(source_id)
        target_node = node_map.get(target_id)

        # Ensure source and target nodes are Entities
        if source_node and target_node and source_node["type"] == "Entity" and target_node["type"] == "Entity":
            pair = tuple(sorted((source_id, target_id)))  # Use sorted tuple to ignore direction

            intermediate_node = node_map.get(link["source"]) #this is the event or relationship node

            if intermediate_node:
              if intermediate_node["type"] == "Event":
                  grouped_interactions[pair]["events"].append(intermediate_node["id"])
              elif intermediate_node["type"] == "Relationship":
                  grouped_interactions[pair]["relationships"].append(intermediate_node["id"])

    # Create aggregated links
    for (source_id, target_id), interactions in grouped_interactions.items():
        new_link = {
            "source": source_id,
            "target": target_id,
            "type": ", ".join(interactions["events"] + interactions["relationships"]),  # Combine event and relationship ids
        }
        aggregated_links.append(new_link)

    # Filter out intermediate Event and Relationship nodes from the aggregated graph
    filtered_nodes = [node for node in nodes if node["type"] == "Entity"]
    print("Aggregation completed.")
    return {"nodes": filtered_nodes, "links": aggregated_links}




