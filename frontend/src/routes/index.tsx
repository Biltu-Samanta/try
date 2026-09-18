import { createFileRoute, redirect, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NER Logistics Accessibility Intelligence" },
      {
        name: "description",
        content:
          "Live logistics accessibility, corridor conditions, and risk intelligence across North East India.",
      },
    ],
  }),
  beforeLoad: () => {
    throw redirect({
      to: "/dashboard",
    });
  },
  component: () => <Navigate to="/dashboard" replace />,
});