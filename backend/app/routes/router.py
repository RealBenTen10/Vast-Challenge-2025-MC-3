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
        session.run("MATCH (n) DETACH DELETE n")  # Clear
        print("Database cleared.")
        # Load nodes
        for node in data.get("nodes", []):
            session.write_transaction(create_node, node)
        print("Nodes loaded successfully.")
        # Load edges
        for edge in data.get("edges", []):
            if "source" in edge and "target" in edge:
                session.write_transaction(create_edge, edge)
        print("Edges loaded successfully.")
        # Transform Relationships
        session.write_transaction(create_relationship_edges)
        print("Relationships transformed successfully.")
        # For testing purpose
        if True:
            # Transform Communication Events
            session.write_transaction(create_communication_edges)
            print("Communication events transformed successfully.")
            # Prune unnecessary edges
            session.run("""MATCH (a)-[r]->(b)
                        WHERE NOT type(r) IN ['COMMUNICATION', 'Colleagues', 'AccessPermission', 'Operates', 'Suspicious', 'Reports', 'Jurisdiction', 'Unfriendly', 'Friends']
                        WITH a, b, collect(r) AS non_essential, size([(a)-[x]->(b) WHERE type(x) IN ['COMMUNICATION', 'Colleagues', 'AccessPermission', 'Operates', 'Suspicious', 'Reports', 'Jurisdiction', 'Unfriendly', 'Friends'] | x]) AS essential_count
                        WHERE essential_count > 0
                        UNWIND non_essential AS r
                        DELETE r
                        """)
    print("Graph loaded successfully.")
    return {"success": True, "message": "All nodes and edges loaded."}



def create_relationship_edges(tx):
    # Get all Relationship nodes
    relationships = tx.run("MATCH (r:Relationship) RETURN r").data()

    for record in relationships:
        r = record['r']
        r_id = r['id']
        sub_type = r.get('sub_type', 'RELATIONSHIP')
        props = dict(r)

        # Find all connected Entities
        entities = tx.run("""
            MATCH (e:Entity)-[]-(r:Relationship {id: $r_id})
            RETURN e.id AS entity_id
        """, r_id=r_id).data()

        entity_ids = [e['entity_id'] for e in entities]

        # Create edges between all pairs of connected Entities
        for i in range(len(entity_ids)):
            for j in range(i + 1, len(entity_ids)):
                source = entity_ids[i]
                target = entity_ids[j]

                tx.run(f"""
                    MATCH (a:Entity {{id: $source}}), (b:Entity {{id: $target}})
                    MERGE (a)-[rel:`{sub_type}`]->(b)
                    SET rel += $props
                """, source=source, target=target, props=props)

        # Delete the Relationship node
        tx.run("MATCH (r:Relationship {id: $r_id}) DETACH DELETE r", r_id=r_id)


def create_communication_edges(tx):
    # Get all Communication Events
    comms = tx.run("MATCH (e:Event {sub_type: 'Communication'}) RETURN e").data()

    for comm in comms:
        event = comm['e']
        event_id = event['id']
        props = dict(event)

        # Get sender and receiver Entities
        participants = tx.run("""
            MATCH (a:Entity)-[:sent]->(comm:Event {id: $event_id})-[:received]->(b:Entity)
            RETURN a.id AS sender, b.id AS receiver
        """, event_id=event_id).data()

        if not participants:
            continue  # Skip if no sender/receiver found

        sender = participants[0]['sender']
        receiver = participants[0]['receiver']

        # Get all `evidence_for` targets
        evidence_links = tx.run("""
            MATCH (comm:Event {id: $event_id})-[:evidence_for]->(target)
            RETURN target.id AS target_id, labels(target) AS target_labels
        """, event_id=event_id).data()

        if evidence_links:
            for link in evidence_links:
                target_id = link['target_id']
                target_labels = link['target_labels']

                if 'Event' in target_labels:
                    # Create A -> EVIDENCE_FOR -> Event
                    tx.run("""
                        MATCH (a:Entity {id: $sender}), (e:Event {id: $target_id})
                        MERGE (a)-[r:EVIDENCE_FOR]->(e)
                        SET r += $props
                    """, sender=sender, target_id=target_id, props=props)

                    # Create Event -> EVIDENCE_FOR -> B
                    tx.run("""
                        MATCH (e:Event {id: $target_id}), (b:Entity {id: $receiver})
                        MERGE (e)-[r:EVIDENCE_FOR]->(b)
                        SET r += $props
                    """, target_id=target_id, receiver=receiver, props=props)

                elif 'Relationship' in target_labels:
                    # Add metadata to existing Relationship edges between Entities
                    tx.run("""
                        MATCH (a:Entity)-[r]->(b:Entity)
                        WHERE (a.id = $sender AND b.id = $receiver) OR (a.id = $receiver AND b.id = $sender)
                        AND type(r) = $rel_type
                        SET r += $props
                    """, sender=sender, receiver=receiver, rel_type=tx.run("""
                        MATCH (r:Relationship {id: $target_id}) RETURN r.sub_type AS rel_type
                    """, target_id=target_id).single()['rel_type'], props=props)

        else:
            # Pure communication between Entities
            tx.run("""
                MATCH (a:Entity {id: $sender}), (b:Entity {id: $receiver})
                MERGE (a)-[r:COMMUNICATION]->(b)
                SET r += $props
            """, sender=sender, receiver=receiver, props=props)

        # Delete the Communication node
        tx.run("MATCH (e:Event {id: $event_id}) DETACH DELETE e", event_id=event_id)

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

# Old functions removed
