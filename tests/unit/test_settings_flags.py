from agentscope.config.settings import Settings


def test_integrations_on_by_default_in_development() -> None:
    settings = Settings(app_env="development", enable_integrations=None)
    assert settings.integrations_enabled() is True


def test_integrations_off_by_default_in_production() -> None:
    settings = Settings(app_env="production", enable_integrations=None)
    assert settings.integrations_enabled() is False


def test_integrations_flag_overrides_app_env() -> None:
    assert (
        Settings(app_env="production", enable_integrations=True).integrations_enabled()
        is True
    )
    assert (
        Settings(
            app_env="development", enable_integrations=False
        ).integrations_enabled()
        is False
    )
