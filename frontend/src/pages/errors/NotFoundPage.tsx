import ErrorPage from "./ErrorPage";

export default function NotFoundPage() {
  return (
    <ErrorPage
      code={404}
      icon="🗺️"
      title="Page Not Found"
      message="The page you're looking for doesn't exist or has been moved. Check the URL or head back to where you came from."
      action={{ label: "Go to Dashboard", to: "/" }}
    />
  );
}