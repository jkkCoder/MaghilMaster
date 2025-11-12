type Message = {
  topic: string;
  msg: string;
  handler: (topic: string, msg: string) => Promise<void>;
};

class MessageQueue {
  private queue: Message[] = [];
  private isProcessing = false;
  private isSyncInProgress = false;
  private processingTimeout: NodeJS.Timeout | null = null;

  /** Add a message to the queue */
  enqueue(topic: string, msg: string, handler: (topic: string, msg: string) => Promise<void>) {
    console.log("📥 Enqueue message:", topic, "Queue length:", this.queue.length + 1);
    this.queue.push({ topic, msg, handler });
    
    // Only trigger processing if not already processing
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  /** Set sync state */
  // setSyncInProgress(state: boolean) {
  //   console.log(" processisSyncInProgress",this.isSyncInProgress)
  //   this.isSyncInProgress = state;
  //   if (!state) {
  //     console.log('🔓 Sync completed — resuming queued processing');
  //     this.processNext();
  //   } else {
  //     console.log('🔒 Sync started — pausing other message processing');
  //   }
  // }

  /** Process one message at a time */
  private async processNext() {
    console.log("🔄 ProcessNext called - Queue length:", this.queue.length, "Processing:", this.isProcessing);
    
    // Early exit conditions
    if (this.isProcessing) {
      console.log("⏸️ Already processing, skipping");
      return;
    }
    
    if (this.queue.length === 0) {
      console.log("📭 Queue empty, stopping processing");
      return;
    }

    // Get the next message
    const message = this.queue.shift();
    if (!message) {
      console.log("❌ No message found after shift");
      return;
    }

    const { topic, msg, handler } = message;
    this.isProcessing = true;
    
    console.log("🚀 Processing message:", topic, "Remaining in queue:", this.queue.length);

    try {
      console.log("⚡ Executing handler for:", topic);
      await handler(topic, msg);
      console.log("✅ Handler completed successfully for:", topic);
    } catch (error) {
      console.error('❌ Error processing MQTT message:', error);
      console.error('❌ Error details:', {
        topic,
        messageLength: msg.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      this.isProcessing = false;
      console.log("🏁 Processing completed for:", topic, "Queue remaining:", this.queue.length);
      
      // Clear any existing timeout
      if (this.processingTimeout) {
        clearTimeout(this.processingTimeout);
        this.processingTimeout = null;
      }
      
      // Only schedule next processing if there are more messages
      if (this.queue.length > 0) {
        console.log("⏰ Scheduling next processing in 50ms");
        this.processingTimeout = setTimeout(() => this.processNext(), 50);
      } else {
        console.log("🏁 No more messages, processing complete");
      }
    }
  }

  clear() {
    console.log("🧹 Clearing message queue");
    this.queue = [];
    this.isProcessing = false;
    
    // Clear any pending timeout
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }

  /** Get queue status for debugging */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      isSyncInProgress: this.isSyncInProgress,
      hasTimeout: !!this.processingTimeout
    };
  }
}

export const messageQueue = new MessageQueue();
