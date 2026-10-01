import { useRef, useCallback, useState, useEffect } from 'react'

/**
 * useAudioCapture — captures microphone audio and emits pristine 16kHz mono WAV chunks.
 *
 * Provides:
 * - Direct 16kHz mono WAV encoding for 100% Sarvam Saaras compatibility
 * - Silence gate (avoids sending empty background noise to ASR)
 * - AnalyserNode for audio visualization
 * - audioLevel (0-100) for real-time VU meter animations
 */
function useAudioCapture({ onChunk, chunkMs = 3500 } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState(null)
  const [analyserNode, setAnalyserNode] = useState(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const processorRef = useRef(null)
  const pcmBufferRef = useRef([])
  const intervalRef = useRef(null)
  const isListeningRef = useRef(false)
  const onChunkRef = useRef(onChunk)

  useEffect(() => {
    onChunkRef.current = onChunk
  }, [onChunk])

  const flushChunk = useCallback(() => {
    if (!pcmBufferRef.current || pcmBufferRef.current.length === 0) return
    const audioCtx = audioCtxRef.current
    if (!audioCtx) return

    // Flatten collected Float32 chunks
    const totalLength = pcmBufferRef.current.reduce((acc, b) => acc + b.length, 0)
    if (totalLength === 0) return

    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const b of pcmBufferRef.current) {
      merged.set(b, offset)
      offset += b.length
    }
    pcmBufferRef.current = []

    // Downsample to 16kHz if audio context runs at 44.1k or 48k
    const inputSampleRate = audioCtx.sampleRate || 16000
    const downsampled = downsampleBuffer(merged, inputSampleRate, 16000)

    // Calculate RMS energy (Voice Activity Detection / Silence Filter)
    let sumSquares = 0
    for (let i = 0; i < downsampled.length; i++) {
      sumSquares += downsampled[i] * downsampled[i]
    }
    const rms = Math.sqrt(sumSquares / downsampled.length)

    // Only transmit if sound energy exceeds ambient noise floor (approx 0.003)
    if (rms >= 0.003) {
      const wavBlob = encodeWAV(downsampled, 16000)
      if (wavBlob.size > 1000) {
        onChunkRef.current?.(wavBlob)
      }
    }
  }, [])

  const start = useCallback(async () => {
    if (isListeningRef.current) return

    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })

      streamRef.current = stream
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext
      const audioCtx = new AudioCtxClass()
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.5
      source.connect(analyser)
      setAnalyserNode(analyser)

      // ScriptProcessor for reliable PCM buffer collection
      const bufferSize = 4096
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1)
      pcmBufferRef.current = []

      processor.onaudioprocess = (e) => {
        if (!isListeningRef.current) return
        const inputData = e.inputBuffer.getChannelData(0)
        pcmBufferRef.current.push(new Float32Array(inputData))

        // Update real-time volume level (0-100)
        let peak = 0
        for (let i = 0; i < inputData.length; i += 8) {
          const abs = Math.abs(inputData[i])
          if (abs > peak) peak = abs
        }
        setAudioLevel(Math.min(100, Math.round(peak * 120)))
      }

      source.connect(processor)
      processor.connect(audioCtx.destination)
      processorRef.current = processor

      // Emit audio chunk periodically
      intervalRef.current = setInterval(() => {
        flushChunk()
      }, chunkMs)

      isListeningRef.current = true
      setIsListening(true)
    } catch (err) {
      console.error('[useAudioCapture] getUserMedia failed:', err)
      setError(err.message ?? 'Microphone access denied. Please grant mic permissions.')
    }
  }, [chunkMs, flushChunk])

  const stop = useCallback(() => {
    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Flush any pending audio before stopping
      flushChunk()

      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current.onaudioprocess = null
        processorRef.current = null
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    } catch (err) {
      console.warn('[useAudioCapture] stop error:', err)
    } finally {
      pcmBufferRef.current = []
      setAnalyserNode(null)
      setAudioLevel(0)
      isListeningRef.current = false
      setIsListening(false)
    }
  }, [flushChunk])

  return {
    start,
    stop,
    isListening,
    error,
    analyserNode,
    audioLevel,
  }
}

/** Downsamples Float32 buffer from inputSampleRate to target sampleRate */
function downsampleBuffer(buffer, inputSampleRate, outputSampleRate = 16000) {
  if (inputSampleRate === outputSampleRate) {
    return buffer
  }
  const sampleRateRatio = inputSampleRate / outputSampleRate
  const newLength = Math.round(buffer.length / sampleRateRatio)
  const result = new Float32Array(newLength)
  let offsetResult = 0
  let offsetBuffer = 0
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
    let accum = 0
    let count = 0
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i]
      count++
    }
    result[offsetResult] = count > 0 ? accum / count : 0
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }
  return result
}

/** Encodes 16-bit Mono PCM Float32 samples into standard RIFF WAV Blob */
function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // Mono channel
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // Byte rate (16000 * 2)
  view.setUint16(32, 2, true) // Block align (1 * 16/8)
  view.setUint16(34, 16, true) // Bits per sample
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export { useAudioCapture }
export default useAudioCapture
