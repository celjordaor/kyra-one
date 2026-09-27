import { RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { getRouter } from "./router";
import "./styles.css";

const rootElement = document.getElementById("root")!;

const router = getRouter();
ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
