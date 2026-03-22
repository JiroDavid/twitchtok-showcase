from fastapi import FastAPI

app = FastAPI(title="AI Twitch Clip Editor API")

@app.get("/")
def root():
    return {"message": "Backend running"}

@app.get("/health")
def health_check():
    return {"status": "good"}