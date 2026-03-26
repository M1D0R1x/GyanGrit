import ErrorPage from "./ErrorPage";

export default function ForbiddenPage() {
  return (
    <ErrorPage
      code={403}
      icon="🔒"
      title="Access Denied"
      message="You don't have permission to view this page. If you believe this is a mistake, contact your administrator."
      action={{ label: "Go to Dashboard", to: "/" }}
    />
  );
}