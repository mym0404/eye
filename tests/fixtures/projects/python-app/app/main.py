from app.helpers import greet
from app.models import User


def run() -> str:
    user = User("Ada")
    return greet(user.name)


if __name__ == "__main__":
    print(run())

