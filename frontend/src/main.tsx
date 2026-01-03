import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { AuthProvider } from "./auth/AuthProvider";

// Root render
createRoot(document.getElementById("root")!).render(
  <AuthProvider role="student">
    <RouterProvider router={router} />
  </AuthProvider>
);
