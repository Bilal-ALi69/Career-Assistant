import json
import requests

BASE_URL = "http://127.0.0.1:8000"

# Setup testing data
user_credentials = {
    "email": "billu_test@gmail.com", 
    "password": "StrongPassword123!"
}

anonymous_payload = {
    "strengths": "Python coding, analytical thinking, hardware prototyping",
    "weaknesses": "high-stress situations, long-duration public speaking",
    "interests": "computer science, physical electronics, hardware engineering"
}

personal_survey = {
    "hobbies": "Electronics projects, robotics, gaming",
    "disabilities": "None",
    "country": "All",
    "education": "Intermediate / HSSC",
    "qualifications": "",
    "work_experience": "Entry-level student with personal hardware and programming projects",
    "preferred_work_environments": "Hybrid or remote, with hardware lab access",
    "career_goals": "Entry-level software, AI, or hardware role"
}

print("--- STEP 1: Registering / Logging in ---")
reg_res = requests.post(f"{BASE_URL}/auth/register", json=user_credentials)
if reg_res.status_code == 201:
    token = reg_res.json()["access_token"]
    print("Registration successful!")
else:
    login_res = requests.post(f"{BASE_URL}/auth/login", json=user_credentials)
    token = login_res.json()["access_token"]
    print("Logged in successfully!")

HEADERS = {"Authorization": f"Bearer {token}"}

print("\n--- STEP 2: Submitting Your In-Depth Profile Survey ---")
profile_res = requests.post(f"{BASE_URL}/auth/profile", json=personal_survey, headers=HEADERS)
print(f"Profile Submit Status: {profile_res.status_code}")
print(profile_res.json())

print("\n--- STEP 3: Requesting Personalized Advice (Cache-Bypass & Ollama Generation) ---")
personalized_res = requests.post(
    f"{BASE_URL}/recommendations/personalized", 
    json=anonymous_payload, 
    headers=HEADERS
)
print(f"Status Code: {personalized_res.status_code}")
print("Response Output:")
print(json.dumps(personalized_res.json(), indent=2))
