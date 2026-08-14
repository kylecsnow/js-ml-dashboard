# js-ml-dashboard

![codecov](https://img.shields.io/badge/codecov-47%25-blue)


This repository contains the code for a collection of Machine Learning tools - primarily a set of quick data visualizations useful 
for EDA and model explainability when training ML models on tabular datasets. This is a Next.js web application, using a frontend
built with React/Typescript and a backend built with FastAPI/Python. You can run the app locally, or access it live on my personal
website [kylecsnow.com](https://kylecsnow.com), where it has been deployed as a containerized application using Docker and AWS.

## Getting Started

### Frontend

cd into the `frontend` directory, then follow the steps below:

Set up pnpm:
```bash
npm install -g pnpm
```
Install packages:
```bash
pnpm install
```
Then run the development server:
```bash
pnpm run dev -p 8777
```

### Backend
Install python dependencies, cd into the `backend` directory, and run:
```bash
python main.py
```
This will run on port 8000 by default.


With both the frontend and backend running, open [http://localhost:8777](http://localhost:8777) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Development

### Backend tests

Tests and coverage settings live in `pyproject.toml` (`testpaths`, `pythonpath`, and `[tool.coverage.run]`). Run **pytest from the repository root** (`js-ml-dashboard`) so those paths resolve correctly.

You need [pytest](https://pytest.org/) and the [pytest-cov](https://pytest-cov.readthedocs.io/) plugin in your environment (for example `conda install pytest-cov` or install the project’s optional dev extras).

Run the suite:

```bash
pytest
```

Run tests with a line-by-line coverage report for application code under `backend/` (test modules under `backend/tests/` are omitted from the report via config):

```bash
pytest --cov=./backend --cov-report=term-missing
```

## Adding Datasets & Models

NOTE: Dataset filenames **must** be in the format `{dataset-name}_dataset.pkl`, where `{dataset-name}` CANNOT contain underscores!

## Environment variables

The Dataset Generator AI chat requires a Groq API key. Create a `.env` file in the repo root (gitignored):

```bash
GROQ_API_KEY=your_key_here
```

Get a key from the [Groq console](https://console.groq.com/). For local Docker, `docker-compose.yml` loads this file via `env_file`. In production on AWS, set `GROQ_API_KEY` as a runtime environment variable or secret.


## Deploying the app to AWS

The app is deployed as a single Docker image to [Amazon ECR](https://aws.amazon.com/ecr/) and run on [AWS App Runner](https://aws.amazon.com/apprunner/). Replace `<AWS-account-ID>` with your AWS account ID and adjust the region if needed.

### 1. Build and test locally

```bash
docker-compose up --build
```

Verify the app works at [http://localhost:8777](http://localhost:8777) before pushing.

### 2. Log in to ECR

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <AWS-account-ID>.dkr.ecr.us-east-1.amazonaws.com
```

### 3. Tag the image

```bash
docker tag js-ml-dashboard-app:latest <AWS-account-ID>.dkr.ecr.us-east-1.amazonaws.com/js-ml-dashboard:latest
```

### 4. (NOTE: only needed the 1st time, then SKIP this step in future runs) Create the ECR repository

```bash
aws ecr create-repository --repository-name js-ml-dashboard
```

### 5. Push to ECR

```bash
docker push <AWS-account-ID>.dkr.ecr.us-east-1.amazonaws.com/js-ml-dashboard:latest
```

### 6. Deploy on App Runner

In the AWS console, go to **App Runner** → **Services** → `js-ml-dashboard` → **Deploy**. If the service is configured to use the `latest` tag, it will pull the new image automatically.

You will need to set the `GROQ_API_KEY` in order for the AI Assistant in the dataset-generator page to function. In AWS, go to App Runner > Services > 
js-ml-dashboard, then click the "Configuration" tab. Go to the "Configure service" section and click "Edit", then add your API key & value and click Save.
