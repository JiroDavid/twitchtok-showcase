from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Twitch Clip Editor API"
    debug: bool = True
    host: str = "127.0.0.1"
    port: int = 8000

    twitch_client_id: str = ""
    twitch_client_secret: str = ""
    twitch_redirect_uri: str = "http://127.0.0.1:8000/auth/twitch/callback"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8"
    )


settings = Settings()