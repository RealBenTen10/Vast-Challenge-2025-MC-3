import random
from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, JSONResponse
from typing import Optional
from neo4j import GraphDatabase
import os
import time
import pandas as pd
from fastapi import BackgroundTasks
import json

# Credentials
NEO4J_URI = "bolt://" + os.environ.get('DB_HOST') + ":7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = os.environ.get('DB_PASSWORD')

router = APIRouter()

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

@router.get("/clear-db", response_class=JSONResponse)
async def clear_db():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
        print("Database cleared.")
        
    return {"success": True}


@router.get("/load-graph-json", response_class=JSONResponse)
async def load_graph_json(background_tasks: BackgroundTasks):
    background_tasks.add_task(load_graph_json)
    return {"success": True, "message": "Graph loading started in background."}



async def load_graph_json():
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
    return {"success": True, "message": "All nodes and edges loaded."}


@router.get("/flatten-communication-events", response_class=JSONResponse)
async def flatten_communication_events():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

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

    return {
        "success": True,
        "message": f"Flattened {len(communications)} Communication events and preserved metadata in new relationships."
    }

@router.get("/combine-communication-links", response_class=JSONResponse)
async def combine_communication_links():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

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

    return {
        "success": True,
        "message": "All communication_links combined per entity-target pair"
    }
@router.get("/remove-non-communication-links", response_class=JSONResponse)
async def remove_non_communication_links():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    with driver.session() as session:
        session.run("""
            MATCH (e:Entity)-[:communication_links]->(t)
            WITH e, t
            MATCH (e)-[r]->(t)
            WHERE type(r) <> 'communication_links'
            DELETE r
        """)

    return {
        "success": True,
        "message": "Removed all redundant non-communication links from Entity"
    }

@router.get("/aggregate-entity-interactions", response_class=JSONResponse)
async def aggregate_entity_interactions_on_the_fly():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    with driver.session() as session:
        # Load all Entity nodes
        result_nodes = session.run("MATCH (n:Entity) RETURN n.id AS id, 'Entity' AS label")
        nodes = [{"id": r["id"], "label": r["label"], "type": "Entity"} for r in result_nodes]

        # Load and aggregate all intermediate Event/Relationship paths
        result_edges = session.run("""
            MATCH (e1:Entity)-[]->(x)<-[]-(e2:Entity)
            WHERE (x:Event OR x:Relationship)
              AND e1.id IS NOT NULL AND e2.id IS NOT NULL
              AND e1.id <> e2.id
            RETURN e1.id AS source, e2.id AS target,
                   collect(x.id) AS ids,
                   collect(labels(x)[0]) AS types,
                   collect(CASE WHEN x.label IS NOT NULL THEN x.label ELSE '' END) AS labels
        """)

        links = []
        for r in result_edges:
            source = r["source"]
            target = r["target"]
            aggregated = list(set(r["ids"]))  # deduplicate
            labels = list(set(r["labels"]))
            types = list(set(r["types"]))
            label_str = ", ".join([l for l in labels if l])

            links.append({
                "source": source,
                "target": target,
                "type": "+".join(types),
                "value": len(aggregated),
                "label": label_str,
                "aggregatedEvents": aggregated
            })

    return {"success": True, "nodes": nodes, "links": links}



    
@router.get("/airport-neighbours", response_class=JSONResponse)
async def get_airport_neighbourhood(iata: str = Query(...), depth: int = Query(...)):
    if depth < 0 or depth > 6:
        return {"success": False, "error-message": "Maximum depth is 6"}
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        with driver.session() as session:
            if depth == 0:
                query = """
                    MATCH (a:Airport {iata: $iata})
                    RETURN collect(a) AS nodes, [] AS relationships
                """
            else:
                match_parts = ["MATCH (a:Airport {iata: $iata})"]
                for i in range(1, depth + 1):
                    left = f"b{i - 1}" if i > 1 else "a"
                    right = f"b{i}"
                    match_parts.append(f"OPTIONAL MATCH ({left})-[:CONNECTED_TO]->({right}:Airport)")

                collect_parts = ["collect(DISTINCT a)"] + [f"collect(DISTINCT b{i})" for i in range(1, depth + 1)]
                query = "\n".join(match_parts)
                query += f"\nWITH { ' + '.join(collect_parts) } AS allNodes"
                query += "\nUNWIND allNodes AS n"
                query += "\nWITH collect(DISTINCT n) AS nodes"
                query += "\nMATCH (n1:Airport)-[r:CONNECTED_TO]->(n2:Airport)"
                query += "\nWHERE n1 IN nodes AND n2 IN nodes"
                query += "\nRETURN nodes, collect(DISTINCT r) AS relationships"

            result = session.run(query, {"iata": iata})
            record = result.single()
            raw_nodes = record["nodes"]
            raw_rels = record["relationships"]

            nodes = []
            links = []

            for node in raw_nodes:
                props = node._properties
                nodes.append({
                    "id": props.get("iata"),
                    "label": props.get("iata"),
                    "group": 1,
                    "degree": props.get("runways", 1),
                    "isOrigin": props.get("iata") == iata
                })

            for rel in raw_rels:
                props = rel._properties
                links.append({
                    "source": rel.start_node["iata"],
                    "target": rel.end_node["iata"],
                    "type": rel.type,
                    "value": props.get("dist", 1)
                })

            return {
                "success": True,
                "nodes": nodes,
                "raw-data": links
            }

    except Exception as e:
        return {"success": False, "error-message": str(e)}
    


@router.get("/read-db-graph", response_class=JSONResponse)
async def read_db_graph():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    with driver.session() as session:
        result_nodes = session.run("MATCH (n) RETURN n.id AS id, labels(n) AS labels")
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
                "label": node_type,
                "type": node_type,
            })

        result_edges = session.run("""
            MATCH (a)-[r]->(b)
            RETURN a.id AS source, b.id AS target, type(r) AS type
        """)
        links = [{"source": r["source"], "target": r["target"], "type": r["type"]} for r in result_edges]

    return {"success": True, "nodes": nodes, "links": links}


