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
        if False:
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
@router.get("/read-db-graph-2", response_class=JSONResponse)
async def read_db_graph_2():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    print("Reading graph data from Neo4j...")
    with driver.session() as session:
        result_nodes = session.run("MATCH (n) RETURN n.id AS id, labels(n) AS labels, n.sub_type AS sub_type, properties(n) AS props")
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
                "label": r.get("label"),
                "type": node_type,
                "sub_type": r.get("sub_type"),
                **r["props"]
            })

        result_edges = session.run("""
            MATCH (a)-[r]->(b)
            RETURN a.id AS source, b.id AS target, type(r) AS type
        """)
        links = [{"source": r["source"], "target": r["target"], "type": r["type"]} for r in result_edges]
    print("Graph data read successfully.")
    return {"success": True, "nodes": nodes, "links": links}

# Old functions removed
@router.get("/read-db-graph", response_class=JSONResponse)
async def read_db_graph():
    print("Reading graph data from Neo4j (aggregated communications)...")
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    nodes = []
    edges = []
    comm_agg_nodes = []
    comm_agg_edges = []
    comm_node_id_map = {}  # (src, tgt) -> agg node id
    try:
        with driver.session() as session:
            # 1. Alle normalen Nodes (außer Communication Events)
            result = session.run("MATCH (n) WHERE NOT (n:Event AND n.sub_type = 'Communication') RETURN n")
            for record in result:
                n = record["n"]
                node_data = dict(n.items())
                node_data["id"] = n.get("id")
                nodes.append(node_data)

            # 2. Communication Events aggregieren
            comm_result = session.run("""
                MATCH (sender:Entity)-[:sent]->(comm:Event {sub_type: 'Communication'})-[:received]->(receiver:Entity)
                RETURN sender.id AS source, receiver.id AS target, collect(comm.content) AS contents, collect(comm.id) AS event_ids, count(*) AS count
            """)
            for rec in comm_result:
                agg_id = f"CommAgg_{rec['source']}_{rec['target']}"
                comm_agg_nodes.append({
                    "id": agg_id,
                    "type": "CommunicationAggregate",
                    "source": rec["source"],
                    "target": rec["target"],
                    "count": rec["count"],
                    "contents": rec["contents"],
                    "event_ids": rec["event_ids"]
                })
                comm_node_id_map[(rec["source"], rec["target"])] = agg_id
                # Kanten von Sender -> AggNode und AggNode -> Empfänger
                comm_agg_edges.append({
                    "source": rec["source"],
                    "target": agg_id,
                    "type": "COMMUNICATION_AGG"
                })
                comm_agg_edges.append({
                    "source": agg_id,
                    "target": rec["target"],
                    "type": "COMMUNICATION_AGG"
                })

            # 3. Alle anderen Kanten (außer Communication zwischen Entities)
            result = session.run("""
                MATCH (a)-[r]->(b)
                WHERE NOT (type(r) = 'COMMUNICATION' AND a:Entity AND b:Entity)
                RETURN a.id AS source, b.id AS target, r
            """)
            for record in result:
                r = record["r"]
                edge_data = dict(r.items())
                edge_data["source"] = record["source"]
                edge_data["target"] = record["target"]
                edge_data["type"] = r.type if hasattr(r, "type") else r.get("type", "")
                edges.append(edge_data)
    finally:
        driver.close()
    # Alle Nodes und Edges zusammenführen
    all_nodes = nodes + comm_agg_nodes
    all_edges = edges + comm_agg_edges
    return {"success": True, "nodes": all_nodes, "links": all_edges}

@router.get("/get-events-by-date", response_class=JSONResponse)
async def get_events_by_date(date: str):
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    cypher = """
    MATCH (e:Event)
    WHERE date(e.timestamp) = date($date)
    OPTIONAL MATCH (e)-[r]-(n)
    RETURN e, r, n
    """
    result_nodes = []
    result_links = []

    with driver.session() as session:
        res = session.run(cypher, date=date)
        for record in res:
            e = record["e"]
            n = record.get("n")
            r = record.get("r")
            result_nodes.append(dict(e))
            if n:
                result_nodes.append(dict(n))
            if r:
                result_links.append({
                    "source": r.start_node["id"],
                    "target": r.end_node["id"],
                    "type": r.type,
                    **dict(r)
                })
    return {"success": True, "nodes": result_nodes, "links": result_links}

@router.get("/filter-by-date", response_class=JSONResponse)
async def filter_by_date(date: str = Query(..., description="YYYY-MM-DD format")):
    """
    Filter graph based on Event timestamp (date). Returns matching Events and their 1-hop neighbors.
    """
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    nodes = []
    edges = []
    print(f"Filtering graph by date: {date}")

    try:
        with driver.session() as session:
            query = """
            MATCH (e:Event)
            WHERE substring(e.timestamp, 0, 10) = $date
            OPTIONAL MATCH (e)-[r]-(m)
            RETURN DISTINCT e, r, m
            """
            result = session.run(query, date=date)

            node_map = {}
            edge_list = []

            for record in result:
                e_node = record["e"]
                m_node = record.get("m")
                r = record.get("r")

                # Add Event node
                if e_node and e_node.id not in node_map:
                    node_map[e_node.id] = e_node
                # Add neighbor node
                if m_node and m_node.id not in node_map:
                    node_map[m_node.id] = m_node
                # Add relationship
                if r:
                    edge_list.append({
                        "source": r.start_node.id,
                        "target": r.end_node.id,
                        "type": r.type,
                        **r._properties
                    })

            nodes = [dict(n._properties, id=n.id) for n in node_map.values()]
            edges = edge_list

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        driver.close()

    return {"success": True, "nodes": nodes, "links": edges}

@router.get("/sankey-communication-flows", response_class=JSONResponse)
async def sankey_communication_flows(
    entity_id: str = Query(..., description="Entity ID to filter communications from"),
    date: str = Query(None, description="Optional date filter in YYYY-MM-DD format")
):
    """
    Returns Sankey data showing how many communications were sent from `entity_id` to other entities,
    optionally filtered by date.
    """
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        with driver.session() as session:
            query = """
            MATCH (sender:Entity {id: $entity_id})-[:sent]->(comm:Event {sub_type: 'Communication'})-[:received]->(receiver:Entity)
            WHERE $date IS NULL OR substring(comm.timestamp, 0, 10) = $date
            RETURN sender.id AS source, receiver.id AS target, count(*) AS count
            """
            result = session.run(query, entity_id=entity_id, date=date)

            sankey_data = []
            for record in result:
                sankey_data.append({
                    "source": record["source"],
                    "target": record["target"],
                    "value": record["count"]
                })

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        driver.close()
    if sankey_data == []:
        return {"success": False, "message": "No communication flows found for the given parameters."}
    return {"success": True, "links": sankey_data}

@router.get("/filter-by-content", response_class=JSONResponse)
async def filter_by_content(query: str = Query(..., description="Search string for content field")):
    """
    Filter graph for communication events by content substring match. Returns matching communication events and their 1-hop neighbors.
    """
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    nodes = []
    edges = []

    print(f"Filtering communication events by content: {query}")

    try:
        with driver.session() as session:
            neo_query = """
            MATCH (e:Event {sub_type: 'Communication'})
            WHERE toLower(e.content) CONTAINS toLower($query)
            OPTIONAL MATCH (e)-[r]-(n)
            RETURN DISTINCT e, r, n
            """
            result = session.run(neo_query, query=query)

            node_map = {}
            edge_list = []

            for record in result:
                e_node = record["e"]
                n_node = record.get("n")
                r = record.get("r")

                if e_node and e_node.id not in node_map:
                    node_map[e_node.id] = e_node
                if n_node and n_node.id not in node_map:
                    node_map[n_node.id] = n_node
                if r:
                    edge_list.append({
                        "source": r.start_node.id,
                        "target": r.end_node.id,
                        "type": r.type,
                        **r._properties
                    })

            nodes = [dict(n._properties, id=n.id) for n in node_map.values()]
            edges = edge_list

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        driver.close()

    return {"success": True, "nodes": nodes, "links": edges}

@router.get("/massive-sequence-view")
async def massive_sequence_view(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD"),
    entity_ids: Optional[str] = Query(None, description="List of Entity IDs"),
    keyword: Optional[str] = Query(None, description="Search keyword in content fields")
):
    print(entity_ids)
    
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    results = []

    try:
        with driver.session() as session:
            # Base MATCH pattern
            cypher_parts = [
                "MATCH (sender:Entity)-[:sent]->(comm:Event {sub_type: 'Communication'})-[:received]->(receiver:Entity)"
            ]

            # WHERE clause parts
            where_clauses = []

            if entity_ids:
                where_clauses.append("sender.id = $entity_ids OR receiver.id = $entity_ids")

            if start_date:
                where_clauses.append("substring(comm.timestamp, 0, 10) >= $start_date")

            if end_date:
                where_clauses.append("substring(comm.timestamp, 0, 10) <= $end_date")

            if keyword:
                where_clauses.append("""
                    any(field IN [comm.content, comm.findings, comm.results, comm.destination, comm.outcome, comm.reference] 
                    WHERE toLower(field) CONTAINS toLower($keyword))
                """)

            if where_clauses:
                cypher_parts.append("WHERE " + " AND ".join(where_clauses))

            # Final RETURN clause
            cypher_parts.append("RETURN comm, sender.id AS source, receiver.id AS target ORDER BY comm.timestamp")

            # Join all parts
            cypher_query = "\n".join(cypher_parts)

            params = {
                "start_date": start_date,
                "end_date": end_date,
                "entity_ids": entity_ids,
                "keyword": keyword,
            }

            records = session.run(cypher_query, **params)

            for record in records:
                event = record["comm"]
                results.append({
                    "event_id": event.id,
                    "timestamp": event["timestamp"],
                    "source": record.get("source") or "–",
                    "target": record.get("target") or "–",
                    "content": event.get("content", ""),
                    "sub_type": event.get("sub_type", ""),
                })

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        driver.close()

    return {"success": True, "data": results}

'''
from fastapi import APIRouter, Query
from neo4j import GraphDatabase
from langchain.chains import RetrievalQA
from langchain.vectorstores import Neo4jVector
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.llms import GPT4All  # or Ollama, LLaMA, etc.

router = APIRouter()
# Credentials
NEO4J_URI = "bolt://" + os.environ.get('DB_HOST') + ":7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = os.environ.get('DB_PASSWORD')

@router.get("/ask")
def ask_question(question: str):
    print(f"Received question: {question}")
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        # You can also chunk documents & embed externally, but here's LangChain Neo4j example
        vectorstore = Neo4jVector(
            driver=driver,
            embedding=HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2"),
            index_name="graph-index",  # ensure this exists
        )

        qa = RetrievalQA.from_chain_type(
            llm=GPT4All(model="mistral-7b-instruct-v0.1.Q4_0.gguf", backend="llama.cpp"),
            retriever=vectorstore.as_retriever()
        )

        answer = qa.run(question)
        return {"success": True, "answer": answer}

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        driver.close()
'''