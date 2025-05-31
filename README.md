# js-ml-dashboard

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