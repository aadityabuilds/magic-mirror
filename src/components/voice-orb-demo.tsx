"use client"

import { useState, useRef, useCallback } from "react"
import SiriOrb from "@/components/smoothui/siri-orb"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Volume2 } from "lucide-react"

export default function VoiceOrbDemo() {
  const [isListening, setIsListening] = useState(false)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const simulationRef = useRef<NodeJS.Timeout | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const [simulatedStream, setSimulatedStream] = useState<MediaStream | null>(null)

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setAudioStream(stream)
      setIsListening(true)
    } catch (error) {
      console.error("Error accessing microphone:", error)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (audioStream) {
      audioStream.getTracks().forEach((track) => track.stop())
      setAudioStream(null)
    }
    setIsListening(false)
  }, [audioStream])

  // Simulate voice activity for demo purposes
  const startSimulation = useCallback(() => {
    // Create audio context and oscillator to generate actual audio signal
    audioContextRef.current = new AudioContext()
    const oscillator = audioContextRef.current.createOscillator()
    const gainNode = audioContextRef.current.createGain()
    const destination = audioContextRef.current.createMediaStreamDestination()

    oscillator.connect(gainNode)
    gainNode.connect(destination)

    oscillator.frequency.value = 200
    gainNode.gain.value = 0
    oscillator.start()

    oscillatorRef.current = oscillator
    setSimulatedStream(destination.stream)
    setIsSimulating(true)

    // Simulate talking pattern
    const simulateTalking = () => {
      if (!gainNode) return

      // Random gain to simulate voice patterns
      const isTalking = Math.random() > 0.3
      const targetGain = isTalking ? 0.3 + Math.random() * 0.7 : 0
      gainNode.gain.setTargetAtTime(targetGain, audioContextRef.current!.currentTime, 0.1)

      // Vary frequency slightly for more natural feel
      oscillator.frequency.value = 150 + Math.random() * 200
    }

    simulationRef.current = setInterval(simulateTalking, 100)
  }, [])

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      clearInterval(simulationRef.current)
      simulationRef.current = null
    }
    if (oscillatorRef.current) {
      oscillatorRef.current.stop()
      oscillatorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setSimulatedStream(null)
    setIsSimulating(false)
  }, [])

  const activeStream = audioStream || simulatedStream
  const isActive = isListening || isSimulating

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative flex items-center justify-center" style={{ width: 250, height: 250 }}>
        <SiriOrb
          size="192px"
          audioStream={activeStream}
          isListening={isActive}
          sensitivity={0.8}
          minScale={1}
          maxScale={1.25}
          colors={{
            bg: "oklch(15% 0.01 264.695)",
            c1: "oklch(70% 0.25 350)",
            c2: "oklch(75% 0.20 200)",
            c3: "oklch(72% 0.22 280)",
          }}
        />
      </div>

      <div className="flex gap-4">
        <Button
          variant={isListening ? "destructive" : "default"}
          onClick={isListening ? stopListening : startListening}
          disabled={isSimulating}
          className="gap-2"
        >
          {isListening ? (
            <>
              <MicOff className="h-4 w-4" />
              Stop Mic
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Use Microphone
            </>
          )}
        </Button>

        <Button
          variant={isSimulating ? "destructive" : "outline"}
          onClick={isSimulating ? stopSimulation : startSimulation}
          disabled={isListening}
          className="gap-2"
        >
          <Volume2 className="h-4 w-4" />
          {isSimulating ? "Stop Demo" : "Simulate Voice"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground text-center max-w-md">
        {isActive
          ? "The orb reacts to audio input - watch it pulse and scale with the sound!"
          : "Click a button to see the orb react to voice. Use your microphone or simulate a voice agent talking."}
      </p>
    </div>
  )
}
