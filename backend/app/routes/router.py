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


# use router.post() instead?
@router.get("/start_loading", response_class=JSONResponse)
async def start_loading(background_tasks: BackgroundTasks):
    
    background_tasks.add_task(load_csv_data)
    return {"success": True, "message": "Started loading in background"}


@router.get("/load-graph-json", response_class=JSONResponse)
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

    return {"success": True, "message": "All nodes and edges loaded."}

from fastapi.responses import JSONResponse
from neo4j import GraphDatabase

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
async def aggregate_entity_interactions():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    with driver.session() as session:

        # Aggregate Events (preserving direction) and delete originals
        session.run("""
            MATCH (e1:Entity)-[]->(ev:Event)<-[]-(e2:Entity)
            WITH e1, e2, collect(ev) AS events
            UNWIND events AS ev
            WITH e1, e2,
                 collect(ev.id) AS ids,
                 collect(ev.sub_type) AS sub_types,
                 collect(CASE WHEN ev.timestamp IS NOT NULL THEN ev.timestamp END) AS timestamps,
                 collect(CASE WHEN ev.content IS NOT NULL THEN ev.content END) AS contents,
                 collect(CASE WHEN ev.label IS NOT NULL THEN ev.label END) AS labels,
                 collect(CASE WHEN ev.monitoring_type IS NOT NULL THEN ev.monitoring_type END) AS monitoring_types,
                 collect(CASE WHEN ev.findings IS NOT NULL THEN ev.findings END) AS findings,
                 collect(CASE WHEN ev.assessment_type IS NOT NULL THEN ev.assessment_type END) AS assessment_types,
                 collect(CASE WHEN ev.results IS NOT NULL THEN ev.results END) AS results,
                 collect(CASE WHEN ev.movement_type IS NOT NULL THEN ev.movement_type END) AS movement_types,
                 collect(CASE WHEN ev.destination IS NOT NULL THEN ev.destination END) AS destinations,
                 collect(CASE WHEN ev.enforcement_type IS NOT NULL THEN ev.enforcement_type END) AS enforcement_types,
                 collect(CASE WHEN ev.outcome IS NOT NULL THEN ev.outcome END) AS outcomes,
                 collect(CASE WHEN ev.activity_type IS NOT NULL THEN ev.activity_type END) AS activity_types,
                 collect(CASE WHEN ev.participants IS NOT NULL THEN ev.participants END) AS participants,
                 collect(CASE WHEN ev.reference IS NOT NULL THEN ev.reference END) AS references,
                 collect(CASE WHEN ev.date IS NOT NULL THEN ev.date END) AS dates,
                 collect(CASE WHEN ev.time IS NOT NULL THEN ev.time END) AS times,
                 collect(ev) AS events_to_delete
            MERGE (agg:AggregatedEvent {from: e1.id, to: e2.id})
            SET agg.ids = ids,
                agg.sub_types = sub_types,
                agg.timestamps = timestamps,
                agg.contents = contents,
                agg.labels = labels,
                agg.monitoring_types = monitoring_types,
                agg.findings = findings,
                agg.assessment_types = assessment_types,
                agg.results = results,
                agg.movement_types = movement_types,
                agg.destinations = destinations,
                agg.enforcement_types = enforcement_types,
                agg.outcomes = outcomes,
                agg.activity_types = activity_types,
                agg.participants = participants,
                agg.references = references,
                agg.dates = dates,
                agg.times = times
            MERGE (e1)-[:aggregated_event_link]->(agg)
            MERGE (agg)-[:aggregated_event_link]->(e2)
            FOREACH (ev IN events_to_delete | DETACH DELETE ev)
        """)

        # Aggregate Relationships (preserving direction) and delete originals
        session.run("""
            MATCH (e1:Entity)-[]->(rel:Relationship)<-[]-(e2:Entity)
            WITH e1, e2, collect(rel) AS rels
            UNWIND rels AS rel
            WITH e1, e2,
                 collect(rel.id) AS ids,
                 collect(rel.sub_type) AS sub_types,
                 collect(CASE WHEN rel.label IS NOT NULL THEN rel.label END) AS labels,
                 collect(CASE WHEN rel.coordination_type IS NOT NULL THEN rel.coordination_type END) AS coordination_types,
                 collect(CASE WHEN rel.start_date IS NOT NULL THEN rel.start_date END) AS start_dates,
                 collect(CASE WHEN rel.end_date IS NOT NULL THEN rel.end_date END) AS end_dates,
                 collect(CASE WHEN rel.permission_type IS NOT NULL THEN rel.permission_type END) AS permission_types,
                 collect(CASE WHEN rel.operational_role IS NOT NULL THEN rel.operational_role END) AS operational_roles,
                 collect(CASE WHEN rel.jurisdiction_type IS NOT NULL THEN rel.jurisdiction_type END) AS jurisdiction_types,
                 collect(CASE WHEN rel.authority_level IS NOT NULL THEN rel.authority_level END) AS authority_levels,
                 collect(CASE WHEN rel.report_type IS NOT NULL THEN rel.report_type END) AS report_types,
                 collect(CASE WHEN rel.submission_date IS NOT NULL THEN rel.submission_date END) AS submission_dates,
                 collect(CASE WHEN rel.friendship_type IS NOT NULL THEN rel.friendship_type END) AS friendship_types,
                 collect(rel) AS rels_to_delete
            MERGE (agg:AggregatedRelationship {from: e1.id, to: e2.id})
            SET agg.ids = ids,
                agg.sub_types = sub_types,
                agg.labels = labels,
                agg.coordination_types = coordination_types,
                agg.start_dates = start_dates,
                agg.end_dates = end_dates,
                agg.permission_types = permission_types,
                agg.operational_roles = operational_roles,
                agg.jurisdiction_types = jurisdiction_types,
                agg.authority_levels = authority_levels,
                agg.report_types = report_types,
                agg.submission_dates = submission_dates,
                agg.friendship_types = friendship_types
            MERGE (e1)-[:aggregated_relationship_link]->(agg)
            MERGE (agg)-[:aggregated_relationship_link]->(e2)
            FOREACH (rel IN rels_to_delete | DETACH DELETE rel)
        """)

        # Aggregate direct links (preserving direction) and delete originals
        session.run("""
            MATCH (e1:Entity)-[r]->(e2:Entity)
            WHERE NOT type(r) IN ['aggregated_event_link', 'aggregated_relationship_link']
              AND e1.id IS NOT NULL AND e2.id IS NOT NULL
            WITH e1, e2, collect(r) AS rels
            UNWIND rels AS r
            WITH e1, e2,
                 collect(type(r)) AS types,
                 collect(CASE WHEN r.comm_id IS NOT NULL THEN r.comm_id END) AS comm_ids,
                 collect(CASE WHEN r.timestamp IS NOT NULL THEN r.timestamp END) AS timestamps,
                 collect(CASE WHEN r.content IS NOT NULL THEN r.content END) AS contents,
                 collect(r) AS rels_to_delete
            MERGE (e1)-[agg:aggregated_direct_link]->(e2)
            SET agg.types = types,
                agg.comm_ids = comm_ids,
                agg.timestamps = timestamps,
                agg.contents = contents
            FOREACH (r IN rels_to_delete | DELETE r)
        """)


    return {
        "success": True,
        "message": "All events, relationships, and links aggregated with full metadata and preserved directionality."
    }


