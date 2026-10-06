import { useState, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import { useDaily } from "../hooks/useDaily";
import { useDeviceId } from "../context/DeviceContext";

export function PredictiveInsights() {
  const { deviceId } = useDeviceId();
  const { daily, loading } = useDaily(deviceId, 30);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [loss, setLoss] = useState<number | null>(null);

  useEffect(() => {
    // We need at least 5 data points to train a meaningful model
    if (loading || daily.length < 5) return;

    let isMounted = true;

    async function trainAndPredict() {
      if (!isMounted) return;
      setIsTraining(true);

      try {
        // 1. Prepare data: predict tomorrow's FVC based on the day number
        // Sort chronologically
        const sorted = [...daily].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
        
        // Features: Day index (0, 1, 2...)
        const xData = sorted.map((_, i) => i);
        // Labels: The FVC on that day
        const yData = sorted.map(d => d.avgFvc);

        // Convert to Tensors
        const xs = tf.tensor2d(xData, [xData.length, 1]);
        const ys = tf.tensor2d(yData, [yData.length, 1]);

        // 2. Define a simple Sequential Neural Network model
        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 8, inputShape: [1], activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1 }));

        model.compile({ optimizer: tf.train.adam(0.1), loss: 'meanSquaredError' });

        // 3. Train the model directly in the browser
        const history = await model.fit(xs, ys, {
          epochs: 100,
          shuffle: true,
          callbacks: {
            // Optional: you could update progress here
          }
        });

        if (!isMounted) return;
        
        const finalLoss = history.history.loss[history.history.loss.length - 1];
        setLoss(Number(finalLoss));

        // 4. Predict the *next* day's FVC (index = length)
        const nextDayIndex = xData.length;
        const nextPrediction = model.predict(tf.tensor2d([nextDayIndex], [1, 1])) as tf.Tensor;
        const predValue = nextPrediction.dataSync()[0];

        setPrediction(predValue);

        // Cleanup memory
        xs.dispose();
        ys.dispose();
        nextPrediction.dispose();
        model.dispose();

      } catch (err) {
        console.error("TensorFlow.js training error:", err);
      } finally {
        if (isMounted) setIsTraining(false);
      }
    }

    // Small delay so it doesn't freeze the UI on mount
    setTimeout(trainAndPredict, 500);

    return () => { isMounted = false; };
  }, [daily, loading]);

  if (loading) return null;

  if (daily.length < 5) {
    return (
      <div style={card}>
        <h3 style={title}>🧠 TensorFlow ML Prediction</h3>
        <p style={text}>
          Collect at least 5 days of data to unlock browser-based Machine Learning predictions. ({daily.length}/5 days)
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h3 style={title}>🧠 TensorFlow ML Prediction</h3>
        {isTraining && (
          <span style={{ fontSize: "0.75rem", color: "#f59e0b", background: "rgba(245,158,11,0.15)", padding: "2px 8px", borderRadius: "12px", fontWeight: 700 }}>
            Training Model...
          </span>
        )}
      </div>

      <p style={text}>
        A local Neural Network just trained on your previous {daily.length} days of data directly in your browser.
      </p>

      {prediction !== null && !isTraining ? (
        <div style={{ marginTop: "16px", padding: "16px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "12px" }}>
          <div style={{ fontSize: "0.8rem", color: "#818cf8", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "4px" }}>
            Predicted Next FVC
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#e0e7ff" }}>
            {prediction.toFixed(2)} <span style={{ fontSize: "1.2rem", color: "#6366f1" }}>Liters</span>
          </div>
          {loss !== null && (
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "8px" }}>
              Model Loss (MSE): {loss.toFixed(4)}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: "16px", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "12px" }}>
          <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Running epochs...</span>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "16px",
  padding: "24px",
  marginTop: "24px"
};

const title: React.CSSProperties = {
  fontSize: "1rem", fontWeight: 700, margin: 0, color: "#f1f5f9"
};

const text: React.CSSProperties = {
  fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.6, margin: "8px 0 0"
};
