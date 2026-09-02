from fastapi import FastAPI

app = FastAPI(title="SatQuery AI")


@app.get("/health")
def health():
    return {"status": "ok"}
