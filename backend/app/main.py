from fastapi import FastAPI

from app.api.songs import router as songs_router


def create_app() -> FastAPI:
    app = FastAPI(title="my-v-coach backend")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(songs_router)
    return app


app = create_app()
