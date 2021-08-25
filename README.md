[![Deploy to Prod](https://github.com/PPIUK/ppi-portal-backend/actions/workflows/production.yml/badge.svg)](https://github.com/PPIUK/ppi-portal-backend/actions/workflows/production.yml)

# PPI Portal - Backend
The backend code for the PPI Portal project. Made using Mongo, Express, NodeJS.

[Documentation](https://github.com/PPIUK/ppi-portal-backend/blob/master/DOCUMENTATION.md)

## Running locally
1. [Install MongoDB](https://docs.mongodb.com/manual/installation/), then run a local instance
2. `npm install` and then `npm start`
    a. Make sure you run the backend first before the frontend, or set backend to port 3000 and frontend to port 3001

## Contributing
### Feature Request
Feature requests can be made in [Issues](https://github.com/PPIUK/ppi-portal-backend/issues)->Feature Request Template

### Bug Report
Bug reports can be made in [Issues](https://github.com/PPIUK/ppi-portal-backend/issues)->Bug Report Template

### Pull Request
First, create an issue for your pull request, then tag that issue in your PR. If the PR links and/or depends on an issue/PR in the [frontend repository](https://github.com/PPIUK/ppi-portal-backend), please link the relevant issue/PR as well (mention `PPIUK/ppi-portal-frontend#<issue number>`).

Please note that since that the backend code stores and processes very _very_ sensitive data, reviewing PRs properly may take a while.
