import random
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, JSONResponse
from neo4j import GraphDatabase
import os
import time
#import pyneoinstance
import pandas as pd

# Credentials
NEO4J_URI = "bolt://" + os.environ.get('DB_HOST') + ":7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = os.environ.get('DB_PASSWORD') # ava25-DB!!

router = APIRouter()

# Example data
sample_people = [
    {"name": "Alice"},
    {"name": "Bob"},
    {"name": "Charlie"}
]
relationships = [
    ("Alice", "Bob", "KNOWS"),
    ("Alice", "Charlie", "FRIENDS_WITH")
]
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


@router.get("/read-db-example", response_class=JSONResponse)
async def read_db_example():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    # Read database and create result array
    with driver.session() as session:
        person_result = session.run("MATCH (p:Person) RETURN p.name AS name, p.age AS age")
        relation_result = session.run("""
                    MATCH (a:Person)-[r]->(b:Person)
                    RETURN a.name AS from, type(r) AS relation, b.name AS to
                """)
        
        if (person_result.peek() is None or relation_result.peek() is None):
            return {"success": False, "error-message": "The database is empty!"}

        dbContentArray = ["People in the database:"]
        
        for record in person_result:
            dbContentArray.append(f" - {record['name']} (age {record['age']})")
        
        dbContentArray.append(" ")
        dbContentArray.append("Relationships in the database:")
                
        for record in relation_result:
            dbContentArray.append(f" - {record['from']} -[{record['relation']}]-> {record['to']})")  
    
    # Just to demonstrate the loading indicator in React
    time.sleep(1)
    
    return {"success": True, "db-content": dbContentArray} 
@router.get("/write-db-example", response_class=JSONResponse)
async def write_db_example():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    with driver.session() as session:
        # Empty database
        session.run("MATCH (n) DETACH DELETE n")
        print("Database cleared.")
    
        # Create nodes
        for person in sample_people:
            session.run(
                "CREATE (p:Person {name: $name, age: $age})",
                name=person["name"], age=random.randint(20, 90)
            )
        print("Sample nodes created.")

        # Create relationships
        for person1, person2, rel_type in relationships:
            session.run(
                """
                MATCH (a:Person {name: $name1}), (b:Person {name: $name2})
                CREATE (a)-[r:%s]->(b)
                """ % rel_type,
                name1=person1, name2=person2
            )
        print("Sample relationships created.")
        
    # Just to demonstrate the loading indicator in React
    time.sleep(1)
    
    return {"success": True}


@router.get("/Test", response_class=JSONResponse)
async def Test():
    print("Current working directory:", os.getcwd())
    files = [entry.name for entry in os.scandir('.') if entry.is_file()]
    return {"files": files}

# Load nodes and edges from provided CSV files
@router.post("/load_csv_data/", response_class=JSONResponse)
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


# Generic function to create a node with dynamic properties
def create_dynamic_node(tx, label, properties):
    keys = list(properties.keys())
    # Create a dynamic Cypher map string like: {name: $name, age: $age, city: $city}
    props_cypher = ", ".join([f"{key}: ${key}" for key in keys])
    query = f"MERGE (n:{label} {{{props_cypher}}})"
    tx.run(query, **properties)
