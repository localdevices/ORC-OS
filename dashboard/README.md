# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

In case reproductivity is required, the template was set up as follows:

Install necessary npm dependency in latest version
```shell
sudo apt install npm
# get the latest version
sudo npm install -g npm@latest
sudo npm install -g node@latest
```

sudo npm install -g npm@latest

```shell
# Create new Vite project
npm create vite@latest portal

# Navigate to project directory
cd portal

# Install dependencies
npm install

# Get axios dependency
npm install axios  # for API connection
npm install react-router-dom  # for organizing the router
npm install dotenv  # for setting environment variables
npm install react-icons
npm install react-zoom-pan-pinch
npm install react-draggable
npm install proj4

# Start dev server, ensuring the API url is added as environment variable
VITE_API_BASE_URL="http://<name-of-server>:<port-of-server>" npm run dev
```

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
