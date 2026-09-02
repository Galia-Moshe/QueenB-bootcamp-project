import React from "react";
import ReactDOM from "react-dom/client";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { prefixer } from "stylis";
import rtlPlugin from "stylis-plugin-rtl";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

document.documentElement.setAttribute("dir", "rtl");
document.documentElement.setAttribute("lang", "he");

const cacheRtl = createCache({
  key: "muirtl",
  stylisPlugins: [prefixer, rtlPlugin],
});

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <CacheProvider value={cacheRtl}>
        <App />
      </CacheProvider>
    </React.StrictMode>
  );
}
