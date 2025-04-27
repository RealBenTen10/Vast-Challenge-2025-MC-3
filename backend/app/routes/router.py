import random
from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, JSONResponse
from typing import Optional
from neo4j import GraphDatabase
import os
import time
import pandas as pd
from fastapi import BackgroundTasks

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

@router.get("/read-db", response_class=JSONResponse)
async def read_db():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    with driver.session() as session:
        airport_result = session.run("MATCH (a:Airport) RETURN a.id AS id, a.city AS city")
        relation_result = session.run("""
                    MATCH (a:Airport)-[CONNECTED_TO]->(b:Airport)
                    RETURN a.iata AS from, type(CONNECTED_TO) AS relation, b.iata AS to        
                                      """)
        if (airport_result.peek() is None or relation_result.peek() is None):
            return {"success": False, "error-message": "The database is empty!"}
        
        dbContentArray = ["Airports in the database:"]

        for attribute in airport_result:
            dbContentArray.append(f" - {attribute['city']}")
            
        dbContentArray.append(" ")
        dbContentArray.append("Relationships in the database:")
                
        for attribute in relation_result:
            dbContentArray.append(f" - {attribute['from']} -[{attribute['relation']}]-> {attribute['to']}")  
    # # Just to demonstrate the loading indicator in React
    time.sleep(1)
    return {"success": True, "db-content": dbContentArray} 


@router.get("/read-db-example", response_class=JSONResponse)
async def db_example():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    with driver.session() as session:
        # Get airport nodes
        print("Getting data...")
        airport_result = session.run("""
            MATCH (a:Airport)
            RETURN a.iata AS iata, a.city AS city, a.country AS country, a.lat AS lat, a.lon AS lon
        """)
        print("Found airports")
        # Get connections between airports
        connection_result = session.run("""
            MATCH (a:Airport)-[r:CONNECTED_TO]->(b:Airport)
            RETURN a.iata AS from_iata, b.iata AS to_iata, r.dist AS distance
        """)
        print("Got connections")
        if airport_result.peek() is None or connection_result.peek() is None:
            return {"success": False, "error-message": "The database contains no airport data."}
        
        dbContentArray = ["Airports in the database:"]
        for record in airport_result:
            dbContentArray.append(
                f" - {record['iata']} ({record['city']}, {record['country']}) "
                f"at [{record['lat']}, {record['lon']}]"
            )
        print("Getting a list")

        dbContentArray.append(" ")
        dbContentArray.append("Connections between airports:")
        for record in connection_result:
            dbContentArray.append(
                f" - {record['from_iata']} -> {record['to_iata']} ({record['distance']} km)"
            )
    
    print("All gotten")

    return {"success": True, "db-content": dbContentArray}

# use router.post() instead?
@router.get("/start_loading", response_class=JSONResponse)
async def start_loading(background_tasks: BackgroundTasks):
    
    background_tasks.add_task(load_csv_data)
    return {"success": True, "message": "Started loading in background"}

# use router.post() instead?
# Load nodes and edges from provided CSV files
@router.get("load_csv_data", response_class=JSONResponse)
async def load_csv_data():
    # Change this e.g. by getting input through react
    
    nodes_path = "nodes.csv"
    edges_path = "edges.csv"
    
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    with driver.session() as session:
        # Clear database - can be omitted for later pipelining
    
        session.run("MATCH (n) DETACH DELETE n")

        # Load nodes
        nodes_df = pd.read_csv(nodes_path)
        print("Handling NaN")
        nodes_df = nodes_df.where(pd.notnull(nodes_df), None)  # Handle NaN
        print("Loading data into neo4j")

        for _, row in nodes_df.iterrows():
            session.run("""
                CREATE (a:Airport {
                    id: $id,
                    iata: $iata,
                    icao: $icao,
                    city: $city,
                    descr: $descr,
                    region: $region,
                    runways: $runways,
                    longest: $longest,
                    altitude: $altitude,
                    country: $country,
                    continent: $continent,
                    lat: $lat,
                    lon: $lon
                })
            """, **row.to_dict())

        print("Loaded nodes - next are edges")
        # Load edges
        edges_df = pd.read_csv(edges_path)
        print("NaN handling")
        edges_df = edges_df.where(pd.notnull(edges_df), None)

        print("Parsing edges")
        for _, row in edges_df.iterrows():
            session.run("""
                MATCH (a:Airport {iata: $src}), (b:Airport {iata: $dest})
                CREATE (a)-[:CONNECTED_TO {dist: $dist}]->(b)
            """, src=row["src"], dest=row["dest"], dist=row["dist"])
        print("All complete! :)")
    return {"success": True, "message": "CSV data loaded into Neo4j."}


@router.get("/top-airports", response_class=JSONResponse)
async def get_top_airports(
    n_airports: int = Query(1, gt=0),
    runways: Optional[int] = Query(None, ge=0),
    continent: Optional[str] = Query(None)
):
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    with driver.session() as session:

        where_conditions = []
        if runways is not None:
            where_conditions.append("a.runways = $runways")
        if continent is not None:
            where_conditions.append("a.continent = $continent")

        where_clause = ""
        if where_conditions:
            where_clause = "WHERE " + " AND ".join(where_conditions)

        query = f"""
            MATCH (a:Airport)-[:CONNECTED_TO]->()
            {where_clause}
            WITH a, count(*) AS out_degree
            ORDER BY out_degree DESC
            LIMIT $limit
            RETURN a.iata AS iata, out_degree
        """

        result = session.run(query, limit=n_airports, runways=runways, continent=continent)

        top_airports = []
        degrees = {}

        for record in result:
            iata = record["iata"]
            degree = record["out_degree"]
            top_airports.append(iata)
            degrees[iata] = degree

        if not top_airports:
            return {"success": False, "error-message": "No top airports found."}

        connections = session.run("""
            UNWIND $iata_list AS code
            MATCH (a:Airport {iata: code})-[r:CONNECTED_TO]->(b:Airport)
            WHERE b.iata IN $iata_list
            RETURN a.iata AS source, b.iata AS target, r.dist AS distance
        """, iata_list=top_airports)

        links = []
        for record in connections:
            links.append({
                "source": record["source"],
                "target": record["target"],
                "type": "CONNECTED_TO",
                "value": 1
            })

        nodes = [{"id": iata, "label": iata, "degree": degrees.get(iata, 1)} for iata in top_airports]

        return {"success": True, "raw-data": links, "nodes": nodes}

@router.get("/continent-graph", response_class=JSONResponse)
async def get_continent_graph():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    with driver.session() as session:
        result = session.run("""
            MATCH (a:Airport)
            WHERE a.continent IS NOT NULL
            RETURN a.continent AS continent, count(a) AS airport_count
        """)

        nodes = []
        for record in result:
            nodes.append({
                "id": record["continent"],
                "label": record["continent"],
                "degree": record["airport_count"]
            })

        return {
            "success": True,
            "nodes": nodes,
            "links": []  # No edges between continents
        }
