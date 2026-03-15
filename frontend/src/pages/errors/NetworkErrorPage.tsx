import ErrorPage from "./ErrorPage";

export default function NetworkErrorPage() {
  return (
    <ErrorPage
      code={0}
      icon="📡"
      title="No Connection"
      message="Unable to reach the server. Check your internet connection and try again. If you're in a low-connectivity area, some features may be available offline."
      action={{ label: "Try Again", to: "/" }}
    />
  );
}