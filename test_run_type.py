import asyncio
from apify_client import ApifyClient
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')

async def test_call_return():
    token = os.getenv('APIFY_API_TOKEN')
    client = ApifyClient(token)
    
    actor_id = "compass/crawler-google-places"
    run_input = {
        "searchStringsArray": ["test"],
        "maxCrawledPlacesPerSearch": 1,
    }
    
    try:
        print("Starting test run...")
        run = client.actor(actor_id).call(run_input=run_input)
        print(f"Return type: {type(run)}")
        print(f"Run data keys/attributes: {dir(run)}")
        
        # Check if it's a dict or object
        if isinstance(run, dict):
            print(f"It's a dict! defaultDatasetId: {run.get('defaultDatasetId')}")
        else:
            print(f"It's an object! default_dataset_id: {getattr(run, 'default_dataset_id', 'N/A')}")
            print(f"Trying subscript access...")
            try:
                print(f"Subscript: {run['defaultDatasetId']}")
            except Exception as e:
                print(f"Subscript failed: {e}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_call_return())
