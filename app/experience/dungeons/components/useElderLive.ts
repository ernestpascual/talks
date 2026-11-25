"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ElderConfig = {
  name: string;
  title: string;
  voice: string;
  personality: string;
};

type LiveStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

function downsampleToPcm16(input: Float32Array, inputRate: number, outputRate = 16000) {
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor];
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return bytesToBase64(new Uint8Array(output.buffer));
}

function base64ToInt16(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Int16Array(bytes.buffer);
}

export function useElderLive() {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [elderTranscript, setElderTranscript] = useState("");
  const websocketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlaybackAtRef = useRef(0);
  const closingRef = useRef(false);

  const stop = useCallback(() => {
    closingRef.current = true;
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
    }
    websocketRef.current?.close();
    websocketRef.current = null;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void inputContextRef.current?.close();
    void outputContextRef.current?.close();
    inputContextRef.current = null;
    outputContextRef.current = null;
    nextPlaybackAtRef.current = 0;
    setStatus("idle");
  }, []);

  const playAudio = useCallback((base64: string) => {
    const context = outputContextRef.current;
    if (!context) return;
    const pcm = base64ToInt16(base64);
    const buffer = context.createBuffer(1, pcm.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index += 1) channel[index] = pcm[index] / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.02, nextPlaybackAtRef.current);
    source.start(startAt);
    nextPlaybackAtRef.current = startAt + buffer.duration;
    setStatus("speaking");
    source.onended = () => {
      if (context.currentTime >= nextPlaybackAtRef.current - 0.05) setStatus("listening");
    };
  }, []);

  const connectInput = useCallback((websocket: WebSocket, stream: MediaStream) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      if (websocket.readyState !== WebSocket.OPEN) return;
      const data = downsampleToPcm16(event.inputBuffer.getChannelData(0), context.sampleRate);
      websocket.send(JSON.stringify({ realtimeInput: { audio: { data, mimeType: "audio/pcm;rate=16000" } } }));
    };
    source.connect(processor);
    processor.connect(context.destination);
    inputContextRef.current = context;
    sourceRef.current = source;
    processorRef.current = processor;
  }, []);

  const start = useCallback(async (elder: ElderConfig, evidence: string) => {
    stop();
    closingRef.current = false;
    setStatus("connecting");
    setError("");
    setUserTranscript("");
    setElderTranscript("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const outputContext = new AudioContext({ sampleRate: 24000 });
      outputContextRef.current = outputContext;
      await outputContext.resume();

      const tokenResponse = await fetch("/api/dungeons/live-token", { method: "POST" });
      const tokenPayload = await tokenResponse.json() as { token?: string; model?: string; error?: string };
      if (!tokenResponse.ok || !tokenPayload.token) throw new Error(tokenPayload.error || "Live token unavailable");

      const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(tokenPayload.token)}`;
      const websocket = new WebSocket(endpoint);
      websocketRef.current = websocket;

      websocket.onopen = () => {
        const systemInstruction = `You are ${elder.name}, ${elder.title}, one of four elders in the ruined town of Techeons. Your personality is ${elder.personality}. The complete Firestore RAG corpus is provided below. Retrieve answers exclusively from this corpus and synthesize across matching evidence and party records when needed. Never invent facts, outside lore, causes, people, or events that are not supported by the corpus. If the corpus does not answer a question, say that your memory does not contain that answer. Stay in character, speak naturally, and keep each response under four sentences.\n\n${evidence || "The RAG corpus is empty."}`;
        websocket.send(JSON.stringify({
          setup: {
            model: `models/${tokenPayload.model || "gemini-3.8-live"}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: elder.voice } } },
            },
            systemInstruction: { parts: [{ text: systemInstruction }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        }));
      };

      websocket.onmessage = async (event) => {
        let rawMessage: string;
        if (typeof event.data === "string") {
          rawMessage = event.data;
        } else if (event.data instanceof Blob) {
          rawMessage = await event.data.text();
        } else if (event.data instanceof ArrayBuffer) {
          rawMessage = new TextDecoder().decode(event.data);
        } else {
          setError("The elder returned an unreadable message.");
          return;
        }

        let message: {
          setupComplete?: unknown;
          serverContent?: {
            inputTranscription?: { text?: string };
            outputTranscription?: { text?: string };
            modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
          };
        };
        try {
          message = JSON.parse(rawMessage) as typeof message;
        } catch {
          setError("The elder returned a malformed message.");
          return;
        }
        if (message.setupComplete) {
          connectInput(websocket, stream);
          setStatus("listening");
        }
        const serverContent = message.serverContent;
        if (serverContent?.inputTranscription?.text) setUserTranscript(serverContent.inputTranscription.text);
        if (serverContent?.outputTranscription?.text) setElderTranscript((current) => `${current}${serverContent.outputTranscription?.text || ""}`);
        for (const part of serverContent?.modelTurn?.parts || []) {
          if (part.inlineData?.data) playAudio(part.inlineData.data);
        }
      };
      websocket.onerror = () => {
        setError("The elder's voice connection was interrupted.");
        setStatus("error");
      };
      websocket.onclose = () => {
        if (!closingRef.current) setStatus("idle");
      };
    } catch (startError) {
      stop();
      setError(startError instanceof Error ? startError.message : "The elder could not be reached.");
      setStatus("error");
    }
  }, [connectInput, playAudio, stop]);

  useEffect(() => stop, [stop]);

  return { status, error, userTranscript, elderTranscript, start, stop };
}

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
