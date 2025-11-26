import { supabase } from "@/integrations/supabase/client";

// Debounced logging to prevent excessive API calls
let logQueue: Array<{ inputFormat: string; outputFormat: string; itemCount: number }> = [];
let logTimeout: NodeJS.Timeout | null = null;

const flushLogs = async () => {
  if (logQueue.length === 0) return;

  const logsToSend = [...logQueue];
  logQueue = [];

  try {
    const { error } = await supabase
      .from("conversions")
      .insert(
        logsToSend.map(log => ({
          input_format: log.inputFormat,
          output_format: log.outputFormat,
          item_count: log.itemCount,
        }))
      );

    if (error) {
      console.error("Failed to log conversions:", error);
    }
  } catch (error) {
    console.error("Failed to log conversions:", error);
  }
};

export const logConversion = (
  inputFormat: string,
  outputFormat: string,
  itemCount: number
) => {
  // Add to queue
  logQueue.push({ inputFormat, outputFormat, itemCount });

  // Debounce: flush after 2 seconds of inactivity
  if (logTimeout) clearTimeout(logTimeout);
  logTimeout = setTimeout(flushLogs, 2000);
};