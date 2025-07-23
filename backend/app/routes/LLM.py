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
        vectorstore = Neo4jVector(
            driver=driver,
            embedding=HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2"),
            index_name="graph-index",  
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
