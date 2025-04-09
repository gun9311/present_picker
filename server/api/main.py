from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import websocket  # 웹소켓 라우터 임포트

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 웹소켓 라우터 등록
app.include_router(websocket.router)

@app.get("/")
async def root():
    return {"message": "Spotlight API Server"}
