import random
from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, JSONResponse
from typing import Optional, List, Dict, Any
from neo4j import GraphDatabase
import networkx as nx
from networkx.readwrite import json_graph
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
    background_tasks.add_task(_load_graph_json)
    return {"success": True, "message": "Graph loading started in background."}

# Tried using networkx to load graph data
async def _load_data():
    print("Loading graph data from file...")
    data_path = "MC3_graph.json"
    schema_path = "MC3_schema.json"

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)["schema"]

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    print("Connecting to Neo4j database...")
    try:
        
        G = json_graph.node_link_graph(data, directed=True, multigraph=False)
        print("Still going...")
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")  # Optionally clear the database
            print("Database cleared.")
            # Add Nodes
            for node_id, attrs in G.nodes(data=True):
                attrs["id"] = attrs.get("id", node_id)
                node_type = attrs.get("type", "Unknown")
                label = node_type  # Use the node type as the label in Neo4j

                props_str = ", ".join(f"{k}: ${k}" for k in attrs)
                query = f"MERGE (n:{label} {{id: $id}}) SET n += {{{props_str}}}"
                session.run(query, **attrs)
            print("Nodes loaded successfully.")
            # Add Edges
            for u, v, edge_attrs in G.edges(data=True):
                edge_type = edge_attrs.get("type", "RELATED_TO")
                edge_attrs["source"] = u
                edge_attrs["target"] = v

                props_str = ", ".join(f"{k}: ${k}" for k in edge_attrs if k not in ("source", "target"))
                query = f"""
                MATCH (a {{id: $source}}), (b {{id: $target}})
                MERGE (a)-[r:{edge_type}]->(b)
                SET r += {{{props_str}}}
                """
                session.run(query, **edge_attrs)
            print("Edges loaded successfully.")
        print("Graph loaded successfully.")
        return {"success": True, "message": "Graph loaded into Neo4j successfully."}

    except Exception as e:
        print("failed to load graph data:", str(e))
        return {"success": False, "error": str(e)}
# This function loads graph data from a JSON file into the Neo4j database.
# It reads the data and schema from the specified JSON files, clears the database,
# and then creates nodes and edges based on the data.
# It is called in the background when the /load-graph-json endpoint is accessed.
async def _load_graph_json():
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
            
            result = session.run("MATCH (n) WHERE NOT (n:Event AND n.sub_type = 'Communication') RETURN n")
            for record in result:
                n = record["n"]
                node_data = dict(n.items())
                node_data["id"] = n.get("id")
                nodes.append(node_data)
                

            comm_result = session.run("""
                MATCH (sender:Entity)-[:sent]->(comm:Event {sub_type: 'Communication'})-[:received]->(receiver:Entity)
                RETURN sender.id AS source, receiver.id AS target, collect(comm.content) AS contents, collect(comm.id) AS event_ids, count(*) AS count, collect(comm.timestamp) AS timestamps
            """)
            for rec in comm_result:
                agg_id = f"CommAgg_{rec['source']}_{rec['target']}"
                comm_agg_nodes.append({
                    "id": agg_id,
                    "type": "Event",
                    "source": rec["source"],
                    "target": rec["target"],
                    "count": rec["count"],
                    "contents": rec["contents"],
                    "event_ids": rec["event_ids"],
                    "timestamps": rec["timestamps"],
                    "sub_type": "Communication"
                })
                comm_node_id_map[(rec["source"], rec["target"])] = agg_id
                comm_agg_edges.append({
                    "source": rec["source"],
                    "target": agg_id,
                    "type": "Event",
                    "sub_type": "Communication"
                })
                comm_agg_edges.append({
                    "source": agg_id,
                    "target": rec["target"]
                })

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
            
            
            
            all_nodes = nodes.copy() + comm_agg_nodes.copy()
            all_edges = edges.copy() + comm_agg_edges.copy()


            # Origin read
            nodes = []
            edges = []
            results = session.run("MATCH (n) RETURN n")
            for record in results:
                n = record["n"]
                node_data = dict(n.items())
                node_data["id"] = n.get("id")
                nodes.append(node_data)

            results = session.run("MATCH (a)-[r]->(b) RETURN a.id AS source, b.id AS target, r")
            for record in results:
                r = record["r"]
                edge_data = dict(r.items())
                edge_data["source"] = record["source"]
                edge_data["target"] = record["target"]
                edge_data["type"] = r.type if hasattr(r, "type") else r.get("type", "")
                edges.append(edge_data)

    except Exception as e:
        print(f"Error reading graph data: {str(e)}")
        return {"success": False, "error": str(e)}
    finally:
        driver.close()

    return {"success": True, "nodes": nodes, "links": edges, "comm_nodes": all_nodes, "comm_links": all_edges}

@router.get("/evidence-for-event", response_class=JSONResponse)
async def evidence_for_event(event_id: str = Query(..., description="ID of the selected event")):
    """
    Given a selected event (e.g., 'Event_Monitoring_0'), return detailed information for each
    communication event that points to it via [:evidence_for] edges, as well as full metadata
    for the target event and its connected entity source/target nodes.
    """
    print("Getting evidence for event:", event_id)
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    results = []
    info = {}

    try:
        with driver.session() as session:
            # get evidence communication events
            evidence_query = """
                MATCH (sender:Entity)-[:sent]->(comm:Event {sub_type: 'Communication'})-[:received]->(receiver:Entity),
                      (comm)-[:evidence_for]->(e:Event {id: $event_id})
                RETURN comm, sender.id AS source, receiver.id AS target
                ORDER BY comm.timestamp
            """
            evidence_records = session.run(evidence_query, event_id=event_id)

            print("Processing communication evidence...")
            for record in evidence_records:
                comm = record["comm"]
                results.append({
                    "event_id": comm.id,
                    "timestamp": comm.get("timestamp", ""),
                    "source": record.get("source", "–"),
                    "target": record.get("target", "–"),
                    "content": comm.get("content", ""),
                    "sub_type": comm.get("sub_type", "")
                })

            # get selected event data and its source and target
            info_query = """
                MATCH (e:Event {id: $event_id})
                OPTIONAL MATCH (source:Entity)-[:RELATED_TO]->(e)
                OPTIONAL MATCH (e)-[:RELATED_TO]->(target:Entity)
                RETURN e, collect(DISTINCT source) AS sources, collect(DISTINCT target) AS targets
            """
            info_record = session.run(info_query, event_id=event_id).single()
            if info_record:
                event_node = info_record["e"]
                source_entities = info_record["sources"]
                target_entities = info_record["targets"]

                info["event"] = dict(event_node.items())
                info["sources"] = [dict(entity.items()) for entity in source_entities if entity]
                info["targets"] = [dict(entity.items()) for entity in target_entities if entity]
            print("Got evidence and info")

    except Exception as e:
        print(f"Error in evidence_for_event: {str(e)}")
        return {"success": False, "error": str(e)}

    finally:
        driver.close()
    print("Returned data: ", results, info)
    return {"success": True, "data": results, "info": info}



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
    sender: Optional[str] = Query(None, description="Sender Entity ID"),
    receiver: Optional[str] = Query(None, description="Receiver Entity ID"),
    start_date: Optional[str] = Query(None, description="Start of timestamp filter (e.g., '2040-10-01 09:00:00')"),
    end_date: Optional[str] = Query(None, description="End of timestamp filter (e.g., '2040-10-01 11:00:00')")
):
    """
    Returns Sankey data showing how many communications were sent from one entity to another,
    optionally filtered by sender, receiver, and timestamp range.
    """
    start_date = start_date.replace("T", " ") if start_date else None
    end_date = end_date.replace("T", " ") if end_date else None
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        with driver.session() as session:
            cypher_parts = [
                "MATCH (sender:Entity)-[:sent]->(comm:Event {sub_type: 'Communication'})-[:received]->(receiver:Entity)"
            ]

            where_clauses = []

            if sender:
                where_clauses.append("sender.id = $sender")
            if receiver:
                where_clauses.append("receiver.id = $receiver")
            if start_date:
                where_clauses.append("comm.timestamp >= $start_date")
            if end_date:
                where_clauses.append("comm.timestamp <= $end_date")
            where_clauses.append("sender.id <> receiver.id")  

            if where_clauses:
                cypher_parts.append("WHERE " + " AND ".join(where_clauses))

            cypher_parts.append("""
                RETURN sender.id AS source, receiver.id AS target, count(*) AS count
            """)

            query = "\n".join(cypher_parts)
            result = session.run(query, sender=sender, receiver=receiver, start_date=start_date, end_date=end_date)

            sankey_data = [
                {
                    "source": record["source"],
                    "target": record["target"],
                    "value": record["count"]
                }
                for record in result
            ]

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        driver.close()

    if not sankey_data:
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

@router.get("/massive-sequence-view", response_class=JSONResponse)
async def massive_sequence_view(
    event_ids: List[str] = Query(..., description="List of communication event node IDs")
):
    """
    Given a list of communication Event node IDs, return their sender and receiver entity IDs.
    """
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    results = []
    # Since the ordering of the events is not correct anymore we have to re-order
    # Since we can't re-order using the Cypher, we just use the inherent ordering of the CommIDs
    

    try:
        with driver.session() as session:
            query = """
                UNWIND $event_ids AS eid
                MATCH (sender:Entity)-[:sent]->(comm:Event {id: eid, sub_type: 'Communication'})-[:received]->(receiver:Entity)
                RETURN comm, sender.id AS source, receiver.id AS target
                ORDER BY comm.timestamp
            """
            records = session.run(query, event_ids=event_ids)

            for record in records:
                comm = record["comm"]
                results.append({
                    "event_id": comm.id,
                    "timestamp": comm.get("timestamp", ""),
                    "source": record.get("source", "–"),
                    "target": record.get("target", "–"),
                    "content": comm.get("content", ""),
                    "sub_type": comm.get("sub_type", "")
                })

    except Exception as e:
        print(f"Error fetching massive sequence view: {str(e)}")    
        return {"success": False, "error": str(e)}
    finally:
        driver.close()
    return {"success": True, "data": results}

@router.post("/event-entities", response_class=JSONResponse)
async def event_entities(event_ids: List[str]):
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    result_map = {}

    try:
        print("Fetching event entities for IDs")
        with driver.session() as session:
            query = """
            UNWIND $event_ids AS eid
            MATCH (ev:Event {id: eid})--(entity:Entity)
            RETURN eid AS event_id, COLLECT(DISTINCT entity.id) AS connected_entities
            """
            records = session.run(query, event_ids=event_ids)
            for record in records:
                event_id = record["event_id"]
                entities = record["connected_entities"] or []

                
                sorted_entities = sorted(entities)
                source = sorted_entities[0]
                target = sorted_entities[1]
                
                result_map[event_id] = {
                    "source": source,
                    "target": target
                }

    except Exception as e:
        print("Error in /event-entities:", str(e))
        return {"success": False, "error": str(e)}
    finally:
        driver.close()

    print("Event entities fetched successfully")
    return {"success": True, "data": result_map}



###
# Here the Similarity Search starts
# First we need to embed the messages

import json
import pandas as pd
import torch
from sentence_transformers import SentenceTransformer, util

# Load the embedding model
embed_model = SentenceTransformer("BAAI/bge-small-en-v1.5", device="cpu")

# Load the graph data from the JSON file to dataframe
with open("MC3_graph.json", "r", encoding="utf-8") as f:
        data = json.load(f)
nodes_df = pd.DataFrame(data['nodes'])

# Filter for communication events
communication_events = nodes_df[nodes_df['sub_type'] == 'Communication'].copy()
communication_events['content'] = communication_events['content'].fillna("")

# Encode the communication events to get their embeddings
print("Encoding communication event content...")
message_texts = [
    "Represent this passage for retrieval: " + msg
    for msg in communication_events["content"]
]
message_embs = embed_model.encode(message_texts, convert_to_tensor=True)
print("Embeddings loaded.")


# Similarity matrix - could be used for adjacency matrix
def calculate_similarity_between_all_messages():
    similarity_matrix = util.cos_sim(message_embs, message_embs)
    similarity_matrix = similarity_matrix.numpy().tolist()

@router.get("/similarity-search", response_class=JSONResponse)
async def similarity_search(
    query: str = Query(..., description="Text query for semantic message similarity"),
    top_k: int = Query(50, description="Number of top similar messages to return"),
    score_threshold: float = Query(0.5, description="Minimum similarity score to consider a match"),
    order_by_time: bool = Query(False)
    ):
    try:
        
        if not query.strip():
            return {"success": False, "error": "Empty query"}

        # Encode the query
        encoded_query = embed_model.encode(
            "Represent this question for retrieving supporting passages: " + query,
            convert_to_tensor=True
        )

        # Compute cosine similarity
        scores = util.cos_sim(encoded_query, message_embs)[0]
        top_indices = torch.topk(scores, k=top_k).indices.cpu().numpy()

        filtered_indices = [i for i in top_indices if scores[i].item() >= score_threshold]

        if not filtered_indices:
            return {"success": True, "data": []}

        # Extract matching rows
        results_df = communication_events.iloc[top_indices].copy()
        results_df["similarity"] = scores[top_indices].cpu().numpy()
        results_df.sort_values(by="similarity", ascending=False, inplace=True)

        event_ids = results_df["id"].tolist()

        # Query Neo4j to get sender and receiver info
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        result = []

        try:
            with driver.session() as session:
                
                cypher_query = """
                UNWIND $ids AS eid
                MATCH (source:Entity)-[:sent]->(comm:Event {id: eid})-[:received]->(target:Entity)
                RETURN comm.id AS event_id, comm.timestamp AS timestamp, comm.content AS content,
                       source.id AS source, target.id AS target
                ORDER BY comm.timestamp
                """
                
                records = session.run(cypher_query, ids=event_ids)
                if order_by_time:
                    print("Here")
                    for row in records:
                        print("Row", row)
                        print(row["event_id"])
                        print()
                        event_id = row["event_id"]
                        result.append({
                            "event_id": row["event_id"],
                            "timestamp": row["timestamp"],
                            "source": row["source"],
                            "target": row["target"],
                            "content": row["content"],
                            "sub_type": "Communication"
                        })
                else:
                    result_map = {record["event_id"]: record for record in records}
                    for _, row in results_df.iterrows():
                        event_id = row["id"]
                        record = result_map.get(event_id, {})
                        result.append({
                            "event_id": event_id,
                            "timestamp": record.get("timestamp", ""),
                            "source": record.get("source", ""),
                            "target": record.get("target", ""),
                            "content": record.get("content", ""),
                            "sub_type": row.get("sub_type", "Communication")
                        })

        finally:
            driver.close()

        return {"success": True, "data": result}

    except Exception as e:
        print("Error in similarity search:", str(e))
        return {"success": False, "error": str(e)}

###  
# Load all events for similarity search using contentFilter
Events = nodes_df[nodes_df['type'] == 'Event'].copy()
Events["full_text"] = Events[["content", "findings", "results", "destination", "outcome", "reference"]].fillna("").agg(" ".join, axis=1)
# Embed the full text of events for similarity search
event_texts = ["Represent this passage for retrieval: " + text for text in Events["full_text"]]
event_embeddings = embed_model.encode(event_texts, convert_to_tensor=True)

@router.get("/similarity-search-events", response_class=JSONResponse)
async def similarity_search_events(
    query: str = Query(...),
    score_threshold: float = Query(0.5, description="Minimum similarity score to consider a match")
    ):
    print(f"Starting similarity search for events with query: {query} and threshold: {score_threshold}")
    try:
        encoded_query = embed_model.encode(
            "Represent this question for retrieving supporting passages: " + query,
            convert_to_tensor=True
        )

        scores = util.cos_sim(encoded_query, event_embeddings)[0]
        top_indices = (scores > score_threshold).nonzero().flatten().cpu().numpy()

        matched_ids = Events.iloc[top_indices]["id"].tolist()
        print(f"Found {len(matched_ids)} matching event IDs with scores above {score_threshold}: {matched_ids}")
        return {"success": True, "event_ids": matched_ids}
    except Exception as e:
        print("Error in similarity search for events:", str(e))
        return {"success": False, "error": str(e)}
