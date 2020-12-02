from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from gm_screen.router import assets, notify, table


app = FastAPI()
app.include_router(assets, prefix="/assets")
app.include_router(notify, prefix="/notify")
app.include_router(table, prefix="/table")
app.mount("/static", StaticFiles(directory="../frontend/dist"), "static")


@app.get("/")
async def home():
    return FileResponse("../frontend/dist/index.html")
