import { initializeCompleteDatabase } from './services/setupDatabase';

// Run this directly in browser console or create a button
const runSetup = async () => {
  console.log("Running setup...");
  const result = await initializeCompleteDatabase();
  console.log("Result:", result);
};

// Run it
runSetup();