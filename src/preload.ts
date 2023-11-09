if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY env var not found");
  process.exit(1);
}
