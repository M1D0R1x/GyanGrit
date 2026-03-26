import ErrorPage from "./ErrorPage";

export default function ServerErrorPage() {
  return (
    <ErrorPage
      code={500}
      icon="🔧"
      title="Something Went Wrong"
      message="The server encountered an error and couldn't complete your request. Our team has been notified. Please try again in a few moments."
      action={{ label: "Try Again", to: "/" }}
    />
  );
}