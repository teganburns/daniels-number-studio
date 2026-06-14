import {
  BarChart3,
  Check,
  ChevronRight,
  Clock,
  Coins,
  Delete,
  Ear,
  Home,
  Keyboard,
  Mic,
  Minus,
  Moon,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Share2,
  Shuffle,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Volume2,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { PRACTICE_LEVELS, PracticeLevel, getNextSample } from './data/practice'
import { speechMatchesNumber } from './lib/match'
import {
  MONEY_DENOMINATIONS,
  MoneyDenominationId,
  formatMoneyTotal,
  getMoneyDenomination,
  isMoneyDenominationId,
  totalMoneyPieces
} from './lib/money'
import { ParsedNumber, parseNumberInput } from './lib/numberWords'
import {
  DEFAULT_PROGRESS,
  ProgressState,
  loadProgress,
  recordListenWin,
  recordSpeakWin,
  recordTimeWin,
  saveProgress,
  updateSpeechSettings
} from './lib/progress'
import {
  browserSpeechProvider,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported
} from './lib/speech'
import {
  TimePeriod,
  TimeValue,
  addHours,
  addMinutes,
  angleToHour,
  angleToMinute,
  createCurrentTimeValue,
  formatTimeValue,
  getNextTimeChallenge,
  getTimeTeachingCue,
  isSameTime,
  pointToClockAngle,
  randomTimeValue,
  setPeriod,
  setPresetMinute,
  timeToAngles,
  timeToSpeechText
} from './lib/time'

type NavId = 'learn' | 'listen' | 'speak' | 'time' | 'money' | 'progress' | 'settings'
type ListenResult = 'idle' | 'correct' | 'try-again'
type SpeakStatus = 'idle' | 'listening' | 'matched' | 'try-again' | 'unsupported'
type TimeResult = 'idle' | 'correct' | 'try-again'
type TimeUnit = 'hour' | 'minute'
type MoneyPieceInstance = {
  id: number
  denominationId: MoneyDenominationId
}

type NavItem = {
  id: NavId
  label: string
  icon: LucideIcon
}

const INITIAL_INPUT = '42105.37'
const CLOCK_PRESETS = [
  { label: '00', cue: "o'clock", minute: 0 },
  { label: '15', cue: 'quarter past', minute: 15 },
  { label: '30', cue: 'half past', minute: 30 },
  { label: '45', cue: 'quarter to', minute: 45 }
]
const TIME_PRESETS = [
  { label: "O'clock", cue: "o'clock", minute: 0 },
  { label: 'Half Past', cue: 'half past', minute: 30 },
  { label: 'Quarter Past', cue: 'quarter past', minute: 15 },
  { label: 'Quarter To', cue: 'quarter to', minute: 45 }
]
const CLOCK_SIZE = 360
const CLOCK_CENTER = CLOCK_SIZE / 2
const HOUR_LABELS = Array.from({ length: 12 }, (_, index) => String(index === 0 ? 12 : index))
const MONEY_DENOMINATION_DRAG_TYPE = 'application/x-money-denomination'
const MONEY_PIECE_DRAG_TYPE = 'application/x-money-piece'
const NAV_ITEMS: NavItem[] = [
  { id: 'learn', label: 'Learn', icon: Home },
  { id: 'listen', label: 'Listen', icon: Ear },
  { id: 'speak', label: 'Speak', icon: Mic },
  { id: 'time', label: 'Time', icon: Clock },
  { id: 'money', label: 'Money', icon: Coins },
  { id: 'progress', label: 'Progress', icon: BarChart3 }
]

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ',', '.', '00', '000']

export default function App() {
  const [activeNav, setActiveNav] = useState<NavId>('learn')
  const [numberInput, setNumberInput] = useState(INITIAL_INPUT)
  const [selectedLevelId, setSelectedLevelId] = useState('decimals')
  const [timeValue, setTimeValue] = useState<TimeValue>(() => createCurrentTimeValue())
  const [moneyPieces, setMoneyPieces] = useState<MoneyPieceInstance[]>([])
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [playbackMessage, setPlaybackMessage] = useState('Ready to practice')
  const [listenAnswer, setListenAnswer] = useState('')
  const [listenResult, setListenResult] = useState<ListenResult>('idle')
  const [speakStatus, setSpeakStatus] = useState<SpeakStatus>('idle')
  const [speakTranscript, setSpeakTranscript] = useState('')
  const [timeResult, setTimeResult] = useState<TimeResult>('idle')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const nextMoneyPieceIdRef = useRef(1)

  const parsedResult = useMemo(() => parseNumberInput(numberInput), [numberInput])
  const selectedLevel = useMemo(
    () => PRACTICE_LEVELS.find((level) => level.id === selectedLevelId) ?? PRACTICE_LEVELS[0],
    [selectedLevelId]
  )
  const selectedCompleted = progress.completed[selectedLevel.id] ?? 0
  const quizInput = getNextSample(selectedLevel, selectedCompleted)
  const quizParsedResult = useMemo(() => parseNumberInput(quizInput), [quizInput])
  const currentParsed = parsedResult.ok ? parsedResult.value : null
  const quizParsed = quizParsedResult.ok ? quizParsedResult.value : null
  const timeChallenge = useMemo(() => getNextTimeChallenge(progress.timeWins), [progress.timeWins])
  const moneyTotal = useMemo(() => totalMoneyPieces(moneyPieces), [moneyPieces])
  const recognitionSupported = isSpeechRecognitionSupported()

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    if (!browserSpeechProvider.isSupported()) {
      return undefined
    }

    const loadVoices = () => setVoices(browserSpeechProvider.getVoices())
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      browserSpeechProvider.cancel()
    }
  }, [])

  const speakText = useCallback(
    async (text: string) => {
      try {
        setPlaybackMessage('Playing...')
        await browserSpeechProvider.speak({ text, settings: progress.settings })
        setPlaybackMessage('Nice listening')
      } catch {
        setPlaybackMessage('Speech is not available in this browser')
      }
    },
    [progress.settings]
  )

  const handlePlayCurrent = useCallback(() => {
    if (currentParsed) {
      void speakText(currentParsed.speechText)
    }
  }, [currentParsed, speakText])

  const handleKey = useCallback((key: string) => {
    setNumberInput((current) => {
      if (key === '.' && current.includes('.')) {
        return current
      }

      if (key === ',' && current.endsWith(',')) {
        return current
      }

      return `${current}${key}`
    })
  }, [])

  const handleBackspace = useCallback(() => {
    setNumberInput((current) => current.slice(0, -1))
  }, [])

  const handleEnterNumber = useCallback(() => {
    if (parsedResult.ok) {
      setNumberInput(parsedResult.value.display)
      setPlaybackMessage('Number ready')
    }
  }, [parsedResult])

  const handleSelectLevel = useCallback(
    (level: PracticeLevel) => {
      setSelectedLevelId(level.id)
      setNumberInput(getNextSample(level, progress.completed[level.id] ?? 0))
      setListenAnswer('')
      setListenResult('idle')
      setActiveNav('listen')
    },
    [progress.completed]
  )

  const handlePlayQuiz = useCallback(() => {
    if (quizParsed) {
      void speakText(quizParsed.speechText)
    }
  }, [quizParsed, speakText])

  const handleCheckListen = useCallback(() => {
    if (!quizParsed) {
      return
    }

    const answer = parseNumberInput(listenAnswer)
    const correct = answer.ok && answer.value.normalized === quizParsed.normalized
    setListenResult(correct ? 'correct' : 'try-again')

    if (correct) {
      setProgress((current) => recordListenWin(current, selectedLevel.id))
      setListenAnswer('')
    }
  }, [listenAnswer, quizParsed, selectedLevel.id])

  const handleStartSpeech = useCallback(() => {
    if (!currentParsed) {
      return
    }

    const Recognition = getSpeechRecognitionConstructor()
    if (!Recognition) {
      setSpeakStatus('unsupported')
      return
    }

    recognitionRef.current?.abort()
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 3

    recognition.onresult = (event) => {
      const transcripts = Array.from(event.results[0])
        .map((result) => result.transcript)
        .join(' ')
      const match = speechMatchesNumber(transcripts, currentParsed)

      setSpeakTranscript(match.normalizedTranscript || transcripts)
      setSpeakStatus(match.matched ? 'matched' : 'try-again')

      if (match.matched) {
        setProgress((current) => recordSpeakWin(current))
      }
    }

    recognition.onerror = () => {
      setSpeakStatus('try-again')
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setSpeakStatus((current) => (current === 'listening' ? 'idle' : current))
    }

    setSpeakTranscript('')
    setSpeakStatus('listening')
    recognition.start()
  }, [currentParsed])

  const handleParentCorrect = useCallback(() => {
    setSpeakStatus('matched')
    setProgress((current) => recordSpeakWin(current))
  }, [])

  const handleTimeChange = useCallback((time: TimeValue) => {
    setTimeValue(time)
    setTimeResult('idle')
  }, [])

  const handleAdjustTime = useCallback((unit: TimeUnit, delta: number) => {
    setTimeValue((current) => (unit === 'hour' ? addHours(current, delta) : addMinutes(current, delta)))
    setTimeResult('idle')
  }, [])

  const handleSetTimePeriod = useCallback((period: TimePeriod) => {
    setTimeValue((current) => setPeriod(current, period))
    setTimeResult('idle')
  }, [])

  const handleSetTimePreset = useCallback((minute: number) => {
    setTimeValue((current) => setPresetMinute(current, minute))
    setTimeResult('idle')
  }, [])

  const handleSetCurrentTime = useCallback(() => {
    setTimeValue(createCurrentTimeValue())
    setTimeResult('idle')
  }, [])

  const handleSetRandomTime = useCallback(() => {
    setTimeValue(randomTimeValue())
    setTimeResult('idle')
  }, [])

  const handlePlayTime = useCallback(() => {
    void speakText(timeToSpeechText(timeValue))
  }, [speakText, timeValue])

  const handleCheckTime = useCallback(() => {
    const correct = isSameTime(timeValue, timeChallenge)
    setTimeResult(correct ? 'correct' : 'try-again')

    if (correct && timeResult !== 'correct') {
      setProgress((current) => recordTimeWin(current))
    }
  }, [timeChallenge, timeResult, timeValue])

  const handleAddMoneyPiece = useCallback((denominationId: MoneyDenominationId) => {
    const id = nextMoneyPieceIdRef.current
    nextMoneyPieceIdRef.current += 1
    setMoneyPieces((current) => [...current, { id, denominationId }])
  }, [])

  const handleRemoveMoneyPiece = useCallback((pieceId: number) => {
    setMoneyPieces((current) => current.filter((piece) => piece.id !== pieceId))
  }, [])

  const handleClearMoneyPieces = useCallback(() => {
    setMoneyPieces([])
  }, [])

  const handleSettingsChange = useCallback(
    (updates: Partial<ProgressState['settings']>) => {
      setProgress((current) =>
        updateSpeechSettings(current, {
          ...current.settings,
          ...updates
        })
      )
    },
    []
  )

  const handleResetProgress = useCallback(() => {
    setProgress(DEFAULT_PROGRESS)
    setListenResult('idle')
    setSpeakStatus('idle')
    setTimeResult('idle')
  }, [])

  return (
    <div className="app-shell">
      <Sidebar
        activeNav={activeNav}
        progress={progress}
        onNavChange={setActiveNav}
      />

      <main className="workspace" aria-label="Daniel's Number Studio">
        <WorkspaceView
          activeNav={activeNav}
          input={numberInput}
          parsed={currentParsed}
          error={parsedResult.ok ? undefined : parsedResult.error}
          playbackMessage={playbackMessage}
          levels={PRACTICE_LEVELS}
          selectedLevel={selectedLevel}
          selectedCompleted={selectedCompleted}
          progress={progress}
          quizParsed={quizParsed}
          timeValue={timeValue}
          timeChallenge={timeChallenge}
          timeResult={timeResult}
          moneyPieces={moneyPieces}
          moneyTotal={moneyTotal}
          listenAnswer={listenAnswer}
          listenResult={listenResult}
          speakStatus={speakStatus}
          speakTranscript={speakTranscript}
          recognitionSupported={recognitionSupported}
          voices={voices}
          onInputChange={setNumberInput}
          onPlayCurrent={handlePlayCurrent}
          onKey={handleKey}
          onBackspace={handleBackspace}
          onClear={() => setNumberInput('')}
          onEnter={handleEnterNumber}
          onSelectLevel={handleSelectLevel}
          onPlayQuiz={handlePlayQuiz}
          onListenAnswerChange={setListenAnswer}
          onCheckListen={handleCheckListen}
          onStartSpeech={handleStartSpeech}
          onParentCorrect={handleParentCorrect}
          onTrySpeechAgain={() => setSpeakStatus('idle')}
          onTimeChange={handleTimeChange}
          onAdjustTime={handleAdjustTime}
          onSetTimePeriod={handleSetTimePeriod}
          onSetTimePreset={handleSetTimePreset}
          onSetCurrentTime={handleSetCurrentTime}
          onSetRandomTime={handleSetRandomTime}
          onPlayTime={handlePlayTime}
          onCheckTime={handleCheckTime}
          onAddMoneyPiece={handleAddMoneyPiece}
          onRemoveMoneyPiece={handleRemoveMoneyPiece}
          onClearMoneyPieces={handleClearMoneyPieces}
          onSettingsChange={handleSettingsChange}
          onResetProgress={handleResetProgress}
        />
      </main>

      <RightRail
        activeNav={activeNav}
        currentParsed={currentParsed}
        selectedLevel={selectedLevel}
        selectedCompleted={selectedCompleted}
        quizParsed={quizParsed}
        listenAnswer={listenAnswer}
        listenResult={listenResult}
        speakStatus={speakStatus}
        speakTranscript={speakTranscript}
        recognitionSupported={recognitionSupported}
        progress={progress}
        voices={voices}
        timeValue={timeValue}
        timeChallenge={timeChallenge}
        timeResult={timeResult}
        moneyPieces={moneyPieces}
        moneyTotal={moneyTotal}
        onPlayTime={handlePlayTime}
        onCheckTime={handleCheckTime}
        onAddMoneyPiece={handleAddMoneyPiece}
        onPlayQuiz={handlePlayQuiz}
        onListenAnswerChange={setListenAnswer}
        onCheckListen={handleCheckListen}
        onStartSpeech={handleStartSpeech}
        onParentCorrect={handleParentCorrect}
        onTrySpeechAgain={() => setSpeakStatus('idle')}
        onSettingsChange={handleSettingsChange}
        onResetProgress={handleResetProgress}
      />
    </div>
  )
}

function WorkspaceView({
  activeNav,
  input,
  parsed,
  error,
  playbackMessage,
  levels,
  selectedLevel,
  selectedCompleted,
  progress,
  quizParsed,
  timeValue,
  timeChallenge,
  timeResult,
  moneyPieces,
  moneyTotal,
  listenAnswer,
  listenResult,
  speakStatus,
  speakTranscript,
  recognitionSupported,
  voices,
  onInputChange,
  onPlayCurrent,
  onKey,
  onBackspace,
  onClear,
  onEnter,
  onSelectLevel,
  onPlayQuiz,
  onListenAnswerChange,
  onCheckListen,
  onStartSpeech,
  onParentCorrect,
  onTrySpeechAgain,
  onTimeChange,
  onAdjustTime,
  onSetTimePeriod,
  onSetTimePreset,
  onSetCurrentTime,
  onSetRandomTime,
  onPlayTime,
  onCheckTime,
  onAddMoneyPiece,
  onRemoveMoneyPiece,
  onClearMoneyPieces,
  onSettingsChange,
  onResetProgress
}: {
  activeNav: NavId
  input: string
  parsed: ParsedNumber | null
  error?: string
  playbackMessage: string
  levels: PracticeLevel[]
  selectedLevel: PracticeLevel
  selectedCompleted: number
  progress: ProgressState
  quizParsed: ParsedNumber | null
  timeValue: TimeValue
  timeChallenge: TimeValue
  timeResult: TimeResult
  moneyPieces: MoneyPieceInstance[]
  moneyTotal: number
  listenAnswer: string
  listenResult: ListenResult
  speakStatus: SpeakStatus
  speakTranscript: string
  recognitionSupported: boolean
  voices: SpeechSynthesisVoice[]
  onInputChange: (value: string) => void
  onPlayCurrent: () => void
  onKey: (value: string) => void
  onBackspace: () => void
  onClear: () => void
  onEnter: () => void
  onSelectLevel: (level: PracticeLevel) => void
  onPlayQuiz: () => void
  onListenAnswerChange: (value: string) => void
  onCheckListen: () => void
  onStartSpeech: () => void
  onParentCorrect: () => void
  onTrySpeechAgain: () => void
  onTimeChange: (time: TimeValue) => void
  onAdjustTime: (unit: TimeUnit, delta: number) => void
  onSetTimePeriod: (period: TimePeriod) => void
  onSetTimePreset: (minute: number) => void
  onSetCurrentTime: () => void
  onSetRandomTime: () => void
  onPlayTime: () => void
  onCheckTime: () => void
  onAddMoneyPiece: (denominationId: MoneyDenominationId) => void
  onRemoveMoneyPiece: (pieceId: number) => void
  onClearMoneyPieces: () => void
  onSettingsChange: (updates: Partial<ProgressState['settings']>) => void
  onResetProgress: () => void
}) {
  if (activeNav === 'listen') {
    return (
      <ListenWorkspace
        levels={levels}
        selectedLevel={selectedLevel}
        selectedCompleted={selectedCompleted}
        progress={progress}
        quizParsed={quizParsed}
        listenAnswer={listenAnswer}
        listenResult={listenResult}
        onSelectLevel={onSelectLevel}
        onPlayQuiz={onPlayQuiz}
        onListenAnswerChange={onListenAnswerChange}
        onCheckListen={onCheckListen}
      />
    )
  }

  if (activeNav === 'speak') {
    return (
      <SpeakWorkspace
        parsed={parsed}
        speakStatus={speakStatus}
        speakTranscript={speakTranscript}
        recognitionSupported={recognitionSupported}
        onPlayCurrent={onPlayCurrent}
        onStartSpeech={onStartSpeech}
        onParentCorrect={onParentCorrect}
        onTrySpeechAgain={onTrySpeechAgain}
      />
    )
  }

  if (activeNav === 'time') {
    return (
      <TimeWorkspace
        time={timeValue}
        targetTime={timeChallenge}
        result={timeResult}
        timeWins={progress.timeWins}
        playbackMessage={playbackMessage}
        onTimeChange={onTimeChange}
        onAdjustTime={onAdjustTime}
        onSetPeriod={onSetTimePeriod}
        onSetPreset={onSetTimePreset}
        onSetNow={onSetCurrentTime}
        onSetRandom={onSetRandomTime}
        onPlayTime={onPlayTime}
        onCheckTime={onCheckTime}
      />
    )
  }

  if (activeNav === 'money') {
    return (
      <MoneyWorkspace
        pieces={moneyPieces}
        totalCents={moneyTotal}
        onAddPiece={onAddMoneyPiece}
        onRemovePiece={onRemoveMoneyPiece}
        onClearPieces={onClearMoneyPieces}
      />
    )
  }

  if (activeNav === 'progress') {
    return (
      <ProgressWorkspace
        progress={progress}
        levels={levels}
        selectedLevel={selectedLevel}
      />
    )
  }

  if (activeNav === 'settings') {
    return (
      <SettingsWorkspace
        progress={progress}
        voices={voices}
        onSettingsChange={onSettingsChange}
        onResetProgress={onResetProgress}
      />
    )
  }

  return (
    <>
      <NumberExplorer
        input={input}
        parsed={parsed}
        error={error}
        playbackMessage={playbackMessage}
        onInputChange={onInputChange}
        onPlay={onPlayCurrent}
        onKey={onKey}
        onBackspace={onBackspace}
        onClear={onClear}
        onEnter={onEnter}
      />

      <PracticeLevels
        levels={levels}
        selectedLevelId={selectedLevel.id}
        progress={progress}
        onSelectLevel={onSelectLevel}
      />
    </>
  )
}

function Sidebar({
  activeNav,
  progress,
  onNavChange
}: {
  activeNav: NavId
  progress: ProgressState
  onNavChange: (nav: NavId) => void
}) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <img src="./mascot.svg" alt="" className="brand-mascot" />
        <div>
          <div className="brand-name">Daniel&apos;s</div>
          <div className="brand-subtitle">Number Studio</div>
        </div>
      </div>

      <nav className="nav-list">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-button ${activeNav === item.id ? 'is-active' : ''}`}
            onClick={() => onNavChange(item.id)}
          >
            <item.icon aria-hidden="true" size={24} strokeWidth={2.2} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-meter" aria-hidden="true">
        <span>0</span>
        <span>1</span>
        <span>2</span>
      </div>

      <div className="learning-card">
        <div className="learning-faces" aria-hidden="true">
          <span>Y</span>
          <span>D</span>
        </div>
        <p>Learning together</p>
        <strong>You &amp; Parent</strong>
      </div>

      <button
        type="button"
        className={`settings-button ${activeNav === 'settings' ? 'is-active' : ''}`}
        onClick={() => onNavChange('settings')}
      >
        <Settings aria-hidden="true" size={20} />
        <span>Settings</span>
      </button>

      <div className="mini-stats" aria-label="Practice stats">
        <span>{progress.streak} day streak</span>
      </div>
    </aside>
  )
}

function NumberExplorer({
  input,
  parsed,
  error,
  playbackMessage,
  onInputChange,
  onPlay,
  onKey,
  onBackspace,
  onClear,
  onEnter
}: {
  input: string
  parsed: ParsedNumber | null
  error?: string
  playbackMessage: string
  onInputChange: (value: string) => void
  onPlay: () => void
  onKey: (value: string) => void
  onBackspace: () => void
  onClear: () => void
  onEnter: () => void
}) {
  return (
    <section className="explorer" aria-labelledby="explorer-title">
      <header className="explorer-header">
        <div>
          <h1 id="explorer-title">Number Explorer</h1>
          <p>{playbackMessage}</p>
        </div>
        <button type="button" className="icon-button" aria-label="Share practice number">
          <Share2 aria-hidden="true" size={20} />
          <span>Share</span>
        </button>
      </header>

      <div className="number-stage">
        <div className="display-number" aria-live="polite">
          {parsed ? parsed.display : input || '0'}
        </div>
        <button
          type="button"
          className="play-button"
          onClick={onPlay}
          disabled={!parsed}
          aria-label="Play number pronunciation"
        >
          <Play aria-hidden="true" size={42} fill="currentColor" />
        </button>
        <span className="play-note">Play number</span>
        <div className="number-line" aria-hidden="true">
          <span>10</span>
          <span>100</span>
          <span>1,000</span>
          <span>10,000</span>
          <span>100,000</span>
          <span>1,000,000</span>
        </div>
      </div>

      <div className="phrase-panel">
        <div className="panel-title">
          <Sparkles aria-hidden="true" size={20} />
          <span>How we say it</span>
        </div>
        <div className="phrase-chunks">
          {parsed ? (
            parsed.chunks.map((chunk, index) => (
              <div className={`phrase-chip phrase-${index + 1}`} key={chunk.id}>
                <span>{chunk.label}</span>
                <strong>{chunk.words}</strong>
              </div>
            ))
          ) : (
            <p className="error-text">{error}</p>
          )}
        </div>
      </div>

      <div className="entry-panel">
        <div className="entry-heading">
          <label htmlFor="number-input">
            <Pencil aria-hidden="true" size={20} />
            Enter a number
          </label>
          <button type="button" className="small-clear" onClick={onClear}>
            <X aria-hidden="true" size={18} />
            Clear
          </button>
        </div>
        <input
          id="number-input"
          className="number-input"
          value={input}
          inputMode="decimal"
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onEnter()
            }
          }}
          aria-describedby={error ? 'number-error' : undefined}
        />
        {error ? (
          <p className="inline-error" id="number-error">
            {error}
          </p>
        ) : null}
        <div className="keypad" aria-label="Number keypad">
          {KEYPAD_KEYS.map((key) => (
            <button key={key} type="button" onClick={() => onKey(key)}>
              {key}
            </button>
          ))}
          <button type="button" className="keypad-delete" onClick={onBackspace} aria-label="Delete">
            <Delete aria-hidden="true" size={24} />
          </button>
          <button type="button" className="keypad-enter" onClick={onEnter}>
            Enter
          </button>
        </div>
      </div>
    </section>
  )
}

function PracticeLevels({
  levels,
  selectedLevelId,
  progress,
  onSelectLevel
}: {
  levels: PracticeLevel[]
  selectedLevelId: string
  progress: ProgressState
  onSelectLevel: (level: PracticeLevel) => void
}) {
  return (
    <section className="practice" aria-labelledby="practice-title">
      <header className="section-heading">
        <h2 id="practice-title">
          <Trophy aria-hidden="true" size={22} />
          Practice Levels
        </h2>
        <button type="button" className="text-link">
          See all levels
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="level-grid">
        {levels.map((level) => {
          const completed = progress.completed[level.id] ?? 0
          const total = level.samples.length
          const percent = Math.min(100, Math.round((completed / total) * 100))
          return (
            <button
              key={level.id}
              type="button"
              className={`level-card accent-${level.accent} ${
                selectedLevelId === level.id ? 'is-selected' : ''
              }`}
              onClick={() => onSelectLevel(level)}
            >
              <span className="level-badge">{levelBadgeText(level)}</span>
              <span className="level-copy">
                <strong>{level.title}</strong>
                <small>{level.level}</small>
              </span>
              <span className="level-score">
                <Star aria-hidden="true" size={18} fill="currentColor" />
                {completed}/{total}
              </span>
              <span className="progress-track" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ListenWorkspace({
  levels,
  selectedLevel,
  selectedCompleted,
  progress,
  quizParsed,
  listenAnswer,
  listenResult,
  onSelectLevel,
  onPlayQuiz,
  onListenAnswerChange,
  onCheckListen
}: {
  levels: PracticeLevel[]
  selectedLevel: PracticeLevel
  selectedCompleted: number
  progress: ProgressState
  quizParsed: ParsedNumber | null
  listenAnswer: string
  listenResult: ListenResult
  onSelectLevel: (level: PracticeLevel) => void
  onPlayQuiz: () => void
  onListenAnswerChange: (value: string) => void
  onCheckListen: () => void
}) {
  return (
    <section className="workspace-view listen-view" aria-labelledby="listen-title">
      <header className="view-header">
        <div>
          <h1 id="listen-title">Listening Challenge</h1>
          <p>{selectedLevel.title} practice, round {selectedCompleted + 1}</p>
        </div>
        <div className="view-counter">
          {selectedCompleted + 1} / {selectedLevel.samples.length}
        </div>
      </header>

      <div className="challenge-board">
        <div className="challenge-card sound-card">
          <div className="status-pill">
            <Ear aria-hidden="true" size={18} />
            Listen
          </div>
          <h2>What number do you hear?</h2>
          <p>Tap the speaker, listen carefully, then type the number.</p>
          <button
            type="button"
            className="sound-button large"
            onClick={onPlayQuiz}
            disabled={!quizParsed}
            aria-label="Play listening challenge number"
          >
            <Volume2 aria-hidden="true" size={64} fill="currentColor" />
          </button>
        </div>

        <div className="challenge-card answer-card">
          <label className="answer-label" htmlFor="listen-answer-main">
            I heard
          </label>
          <input
            id="listen-answer-main"
            className="challenge-input"
            value={listenAnswer}
            onChange={(event) => onListenAnswerChange(event.target.value)}
            inputMode="decimal"
            placeholder="42,105.37"
          />
          <button type="button" className="primary-action" onClick={onCheckListen}>
            Check my answer
          </button>
          <QuizFeedback result={listenResult} />
        </div>
      </div>

      <PracticeLevels
        levels={levels}
        selectedLevelId={selectedLevel.id}
        progress={progress}
        onSelectLevel={onSelectLevel}
      />
    </section>
  )
}

function SpeakWorkspace({
  parsed,
  speakStatus,
  speakTranscript,
  recognitionSupported,
  onPlayCurrent,
  onStartSpeech,
  onParentCorrect,
  onTrySpeechAgain
}: {
  parsed: ParsedNumber | null
  speakStatus: SpeakStatus
  speakTranscript: string
  recognitionSupported: boolean
  onPlayCurrent: () => void
  onStartSpeech: () => void
  onParentCorrect: () => void
  onTrySpeechAgain: () => void
}) {
  return (
    <section className="workspace-view speak-view" aria-labelledby="speak-title">
      <header className="view-header">
        <div>
          <h1 id="speak-title">Speaking Challenge</h1>
          <p>Listen once, then say the number out loud.</p>
        </div>
        <div className="status-pill turn">
          <Mic aria-hidden="true" size={18} />
          Your Turn
        </div>
      </header>

      <div className="speak-stage">
        <div>
          <div className="display-number compact">{parsed?.display ?? 'Enter a number'}</div>
          <div className="phrase-panel speak-phrase">
            <div className="panel-title">
              <Sparkles aria-hidden="true" size={20} />
              <span>Say it like this</span>
            </div>
            <div className="phrase-chunks">
              {parsed ? (
                parsed.chunks.map((chunk, index) => (
                  <div className={`phrase-chip phrase-${index + 1}`} key={chunk.id}>
                    <span>{chunk.label}</span>
                    <strong>{chunk.words}</strong>
                  </div>
                ))
              ) : (
                <p className="error-text">Go to Learn and enter a number first.</p>
              )}
            </div>
          </div>
        </div>

        <div className="challenge-card speak-card">
          <button
            type="button"
            className="play-mini"
            onClick={onPlayCurrent}
            disabled={!parsed}
          >
            <Volume2 aria-hidden="true" size={22} />
            Hear it first
          </button>
          <button
            type="button"
            className={`mic-button large ${speakStatus === 'listening' ? 'is-listening' : ''}`}
            onClick={onStartSpeech}
            disabled={!parsed || speakStatus === 'listening'}
            aria-label="Start speaking challenge"
          >
            <Mic aria-hidden="true" size={68} />
          </button>
          <SpeakFeedback
            status={speakStatus}
            transcript={speakTranscript}
            recognitionSupported={recognitionSupported}
            onParentCorrect={onParentCorrect}
            onTryAgain={onTrySpeechAgain}
          />
        </div>
      </div>
    </section>
  )
}

function MoneyWorkspace({
  pieces,
  totalCents,
  onAddPiece,
  onRemovePiece,
  onClearPieces
}: {
  pieces: MoneyPieceInstance[]
  totalCents: number
  onAddPiece: (denominationId: MoneyDenominationId) => void
  onRemovePiece: (pieceId: number) => void
  onClearPieces: () => void
}) {
  const trayRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    source: 'palette' | 'tray'
    denominationId: MoneyDenominationId
    pieceId?: number
    pointerId: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const ignoreClickRef = useRef(false)
  const [dragPreview, setDragPreview] = useState<{
    source: 'palette' | 'tray'
    denominationId: MoneyDenominationId
    removeReady: boolean
    x: number
    y: number
  } | null>(null)
  const [isNativeDragOver, setIsNativeDragOver] = useState(false)

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    source: 'palette' | 'tray',
    denominationId: MoneyDenominationId,
    pieceId?: number
  ) => {
    dragRef.current = {
      source,
      denominationId,
      pieceId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    }
    ignoreClickRef.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
    if (distance > 6) {
      drag.moved = true
      setDragPreview({
        source: drag.source,
        denominationId: drag.denominationId,
        removeReady: drag.source === 'tray' && !isPointInsideElement(event.clientX, event.clientY, trayRef.current),
        x: event.clientX,
        y: event.clientY
      })
    }
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const endedInTray = isPointInsideElement(event.clientX, event.clientY, trayRef.current)
    if (drag.moved && drag.source === 'palette' && endedInTray) {
      onAddPiece(drag.denominationId)
    }

    if (drag.moved && drag.source === 'tray' && !endedInTray && drag.pieceId !== undefined) {
      onRemovePiece(drag.pieceId)
    }

    ignoreClickRef.current = drag.moved
    dragRef.current = null
    setDragPreview(null)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const handlePieceClick = (denominationId: MoneyDenominationId) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false
      return
    }

    onAddPiece(denominationId)
  }

  const handlePlacedPieceClick = (pieceId: number) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false
      return
    }

    onRemovePiece(pieceId)
  }

  const handleDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    denominationId: MoneyDenominationId
  ) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(MONEY_DENOMINATION_DRAG_TYPE, denominationId)
    event.dataTransfer.setData('text/plain', denominationId)
  }

  const handlePlacedDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    pieceId: number
  ) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(MONEY_PIECE_DRAG_TYPE, String(pieceId))
  }

  const handleRemoveDragOver = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleRemoveDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault()

    const pieceId = Number(event.dataTransfer.getData(MONEY_PIECE_DRAG_TYPE))
    if (Number.isInteger(pieceId)) {
      onRemovePiece(pieceId)
    }
  }

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsNativeDragOver(true)
  }

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsNativeDragOver(false)

    const denominationId =
      event.dataTransfer.getData(MONEY_DENOMINATION_DRAG_TYPE) ||
      event.dataTransfer.getData('text/plain')
    if (isMoneyDenominationId(denominationId)) {
      onAddPiece(denominationId)
    }
  }

  return (
    <section className="workspace-view money-view" aria-labelledby="money-title">
      <header className="view-header">
        <div>
          <h1 id="money-title">Money Count</h1>
          <p>Free play</p>
        </div>
        <div className="view-counter money-total-counter" aria-live="polite">
          {formatMoneyTotal(totalCents)}
        </div>
      </header>

      <div className="money-board">
        <section
          className="money-card money-bank"
          role="region"
          aria-labelledby="money-bank-title"
          onDragOver={handleRemoveDragOver}
          onDrop={handleRemoveDrop}
        >
          <header className="money-card-header">
            <div>
              <Coins aria-hidden="true" size={22} />
              <h2 id="money-bank-title">Money Pieces</h2>
            </div>
          </header>

          <div className="money-palette" aria-label="Money pieces">
            {MONEY_DENOMINATIONS.map((denomination) => (
              <button
                key={denomination.id}
                type="button"
                className={moneyPieceClassName(denomination.kind)}
                draggable
                onClick={() => handlePieceClick(denomination.id)}
                onDragStart={(event) => handleDragStart(event, denomination.id)}
                onPointerDown={(event) => handlePointerDown(event, 'palette', denomination.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                aria-label={`Add ${denomination.label}`}
              >
                <MoneyPieceFace denominationId={denomination.id} />
              </button>
            ))}
          </div>
        </section>

        <section className="money-card money-tray-panel" aria-labelledby="money-tray-title">
          <header className="money-card-header">
            <div>
              <Sparkles aria-hidden="true" size={22} />
              <h2 id="money-tray-title">Counting Tray</h2>
            </div>
            <button
              type="button"
              className="small-clear"
              onClick={onClearPieces}
              disabled={pieces.length === 0}
            >
              <X aria-hidden="true" size={18} />
              Clear tray
            </button>
          </header>

          <div className="money-total-display" aria-live="polite">
            <span>Total</span>
            <strong>{formatMoneyTotal(totalCents)}</strong>
          </div>

          <div
            ref={trayRef}
            className={`money-tray ${pieces.length === 0 ? 'is-empty' : ''} ${
              isNativeDragOver ? 'is-drag-over' : ''
            }`}
            role="region"
            aria-label="Counting tray"
            onDragEnter={() => setIsNativeDragOver(true)}
            onDragLeave={() => setIsNativeDragOver(false)}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {pieces.length === 0 ? (
              <p>Drop money here</p>
            ) : (
              pieces.map((piece) => {
                const denomination = getMoneyDenomination(piece.denominationId)
                return (
	                  <button
	                    key={piece.id}
	                    type="button"
	                    className={`${moneyPieceClassName(denomination.kind)} is-placed`}
	                    draggable
	                    onClick={() => handlePlacedPieceClick(piece.id)}
	                    onDragStart={(event) => handlePlacedDragStart(event, piece.id)}
	                    onPointerDown={(event) =>
	                      handlePointerDown(event, 'tray', piece.denominationId, piece.id)
	                    }
	                    onPointerMove={handlePointerMove}
	                    onPointerUp={handlePointerEnd}
	                    onPointerCancel={handlePointerEnd}
	                    aria-label={`Remove ${denomination.label}`}
	                  >
                    <MoneyPieceFace denominationId={piece.denominationId} compact />
                  </button>
                )
              })
            )}
          </div>
        </section>
      </div>

      {dragPreview ? (
        <div
          className={`money-drag-preview ${moneyPieceClassName(
            getMoneyDenomination(dragPreview.denominationId).kind
          )} ${dragPreview.removeReady ? 'is-remove-ready' : ''}`}
          style={{ left: dragPreview.x, top: dragPreview.y }}
          aria-hidden="true"
        >
          <MoneyPieceFace
            denominationId={dragPreview.denominationId}
            compact={dragPreview.source === 'tray'}
          />
        </div>
      ) : null}
    </section>
  )
}

function MoneyPieceFace({
  denominationId,
  compact = false
}: {
  denominationId: MoneyDenominationId
  compact?: boolean
}) {
  const denomination = getMoneyDenomination(denominationId)

  return (
    <>
      <span className="money-piece-image" aria-hidden="true">
        <img src={denomination.assetSrc} alt="" draggable={false} />
      </span>
      <span className="money-piece-value">{denomination.display}</span>
      <span className="money-piece-label">{compact ? denomination.label.split(' ')[0] : denomination.label}</span>
    </>
  )
}

function moneyPieceClassName(kind: 'bill' | 'coin'): string {
  return `money-piece is-${kind}`
}

function isPointInsideElement(x: number, y: number, element: HTMLElement | null): boolean {
  if (!element) {
    return false
  }

  const rect = element.getBoundingClientRect()
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function ProgressWorkspace({
  progress,
  levels,
  selectedLevel
}: {
  progress: ProgressState
  levels: PracticeLevel[]
  selectedLevel: PracticeLevel
}) {
  const totalCompleted = Object.values(progress.completed).reduce((sum, count) => sum + count, 0)

  return (
    <section className="workspace-view progress-view" aria-labelledby="progress-title">
      <header className="view-header">
        <div>
          <h1 id="progress-title">Progress</h1>
          <p>Small wins add up.</p>
        </div>
        <div className="medal">
          <Star aria-hidden="true" size={22} fill="currentColor" />
          <span>{totalCompleted}</span>
        </div>
      </header>

      <div className="dashboard-grid">
        <StatCard label="Listening wins" value={progress.listenWins} />
        <StatCard label="Speaking wins" value={progress.speakWins} />
        <StatCard label="Practice streak" value={progress.streak} />
      </div>

      <section className="progress-table" aria-labelledby="level-progress-title">
        <h2 id="level-progress-title">Level progress</h2>
        {levels.map((level) => {
          const completed = progress.completed[level.id] ?? 0
          const percent = Math.min(100, Math.round((completed / level.samples.length) * 100))
          return (
            <div
              className={`progress-row accent-${level.accent} ${
                selectedLevel.id === level.id ? 'is-selected' : ''
              }`}
              key={level.id}
            >
              <span className="level-badge">{levelBadgeText(level)}</span>
              <div>
                <strong>{level.title}</strong>
                <small>{level.subtitle}</small>
              </div>
              <span>{completed}/{level.samples.length}</span>
              <span className="progress-track" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </span>
            </div>
          )
        })}
      </section>
    </section>
  )
}

function SettingsWorkspace({
  progress,
  voices,
  onSettingsChange,
  onResetProgress
}: {
  progress: ProgressState
  voices: SpeechSynthesisVoice[]
  onSettingsChange: (updates: Partial<ProgressState['settings']>) => void
  onResetProgress: () => void
}) {
  return (
    <section className="workspace-view settings-view" aria-labelledby="settings-title">
      <header className="view-header">
        <div>
          <h1 id="settings-title">Settings</h1>
          <p>Choose the voice and pace that feel best for Daniel.</p>
        </div>
        <Settings aria-hidden="true" size={30} />
      </header>

      <div className="settings-card">
        <SettingsFields
          progress={progress}
          voices={voices}
          onSettingsChange={onSettingsChange}
          onResetProgress={onResetProgress}
        />
      </div>
    </section>
  )
}

function levelBadgeText(level: PracticeLevel): string {
  if (level.title === 'Decimals') {
    return '.25'
  }

  if (level.title === 'Hundreds') {
    return '100'
  }

  if (level.title === 'Millions') {
    return 'M'
  }

  if (level.title === 'Mixed Review') {
    return 'Mix'
  }

  return '1K'
}

function RightRail({
  activeNav,
  currentParsed,
  selectedLevel,
  selectedCompleted,
  quizParsed,
  listenAnswer,
  listenResult,
  speakStatus,
  speakTranscript,
  recognitionSupported,
  progress,
  voices,
  timeValue,
  timeChallenge,
  timeResult,
  moneyPieces,
  moneyTotal,
  onPlayTime,
  onCheckTime,
  onAddMoneyPiece,
  onPlayQuiz,
  onListenAnswerChange,
  onCheckListen,
  onStartSpeech,
  onParentCorrect,
  onTrySpeechAgain,
  onSettingsChange,
  onResetProgress
}: {
  activeNav: NavId
  currentParsed: ParsedNumber | null
  selectedLevel: PracticeLevel
  selectedCompleted: number
  quizParsed: ParsedNumber | null
  listenAnswer: string
  listenResult: ListenResult
  speakStatus: SpeakStatus
  speakTranscript: string
  recognitionSupported: boolean
  progress: ProgressState
  voices: SpeechSynthesisVoice[]
  timeValue: TimeValue
  timeChallenge: TimeValue
  timeResult: TimeResult
  moneyPieces: MoneyPieceInstance[]
  moneyTotal: number
  onPlayTime: () => void
  onCheckTime: () => void
  onAddMoneyPiece: (denominationId: MoneyDenominationId) => void
  onPlayQuiz: () => void
  onListenAnswerChange: (value: string) => void
  onCheckListen: () => void
  onStartSpeech: () => void
  onParentCorrect: () => void
  onTrySpeechAgain: () => void
  onSettingsChange: (updates: Partial<ProgressState['settings']>) => void
  onResetProgress: () => void
}) {
  if (activeNav === 'progress') {
    return <ProgressRail progress={progress} selectedLevel={selectedLevel} />
  }

  if (activeNav === 'settings') {
    return (
      <SettingsRail
        progress={progress}
        voices={voices}
        onSettingsChange={onSettingsChange}
        onResetProgress={onResetProgress}
      />
    )
  }

  if (activeNav === 'time') {
    return (
      <TimeRail
        time={timeValue}
        targetTime={timeChallenge}
        result={timeResult}
        onPlayTime={onPlayTime}
        onCheckTime={onCheckTime}
      />
    )
  }

  if (activeNav === 'money') {
    return (
      <MoneyRail
        pieceCount={moneyPieces.length}
        totalCents={moneyTotal}
        onAddPiece={onAddMoneyPiece}
      />
    )
  }

  return (
    <aside className="right-rail" aria-label="Listen and speak quiz">
      <header className="quiz-header">
        <div>
          <h2>Listen &amp; Speak Quiz</h2>
          <p>
            {selectedCompleted + 1} / {selectedLevel.samples.length}
          </p>
        </div>
        <div className="medal" aria-label={`${progress.listenWins + progress.speakWins} wins`}>
          <Trophy aria-hidden="true" size={18} fill="currentColor" />
          <span>{progress.listenWins + progress.speakWins}</span>
        </div>
      </header>

      <section className={`quiz-block ${activeNav === 'listen' ? 'is-focused' : ''}`}>
        <div className="status-pill">
          <Ear aria-hidden="true" size={18} />
          Listening
        </div>
        <p>Listen to the number.</p>
        <strong>What number do you hear?</strong>
        <button
          type="button"
          className="sound-button"
          onClick={onPlayQuiz}
          disabled={!quizParsed}
          aria-label="Play listening quiz number"
        >
          <Volume2 aria-hidden="true" size={54} fill="currentColor" />
        </button>
        <label className="answer-label" htmlFor="listen-answer">
          I heard
        </label>
        <div className="answer-row">
          <input
            id="listen-answer"
            value={listenAnswer}
            onChange={(event) => onListenAnswerChange(event.target.value)}
            inputMode="decimal"
            placeholder="42,105.37"
          />
          <button type="button" onClick={onCheckListen}>
            Check
          </button>
        </div>
        <QuizFeedback result={listenResult} />
      </section>

      <section className={`quiz-block ${activeNav === 'speak' ? 'is-focused' : ''}`}>
        <div className="status-pill turn">
          <Mic aria-hidden="true" size={18} />
          Your Turn
        </div>
        <p>Say the number out loud.</p>
        <strong className="speak-target">{currentParsed?.display ?? 'Enter a number'}</strong>
        <button
          type="button"
          className={`mic-button ${speakStatus === 'listening' ? 'is-listening' : ''}`}
          onClick={onStartSpeech}
          disabled={!currentParsed || speakStatus === 'listening'}
          aria-label="Start speaking quiz"
        >
          <Mic aria-hidden="true" size={56} />
        </button>
        <SpeakFeedback
          status={speakStatus}
          transcript={speakTranscript}
          recognitionSupported={recognitionSupported}
          onParentCorrect={onParentCorrect}
          onTryAgain={onTrySpeechAgain}
        />
      </section>
    </aside>
  )
}

function QuizFeedback({ result }: { result: ListenResult }) {
  if (result === 'correct') {
    return (
      <p className="feedback success">
        <Check aria-hidden="true" size={18} />
        Great ear. Next one is ready.
      </p>
    )
  }

  if (result === 'try-again') {
    return (
      <p className="feedback retry">
        <RotateCcw aria-hidden="true" size={18} />
        Try that one again.
      </p>
    )
  }

  return <p className="feedback muted">Tap play when you are ready.</p>
}

function SpeakFeedback({
  status,
  transcript,
  recognitionSupported,
  onParentCorrect,
  onTryAgain
}: {
  status: SpeakStatus
  transcript: string
  recognitionSupported: boolean
  onParentCorrect: () => void
  onTryAgain: () => void
}) {
  if (!recognitionSupported || status === 'unsupported') {
    return (
      <div className="parent-check">
        <p>Microphone checking is unavailable here.</p>
        <div>
          <button type="button" onClick={onParentCorrect}>
            Correct
          </button>
          <button type="button" onClick={onTryAgain}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (status === 'listening') {
    return (
      <p className="feedback listening">
        <Keyboard aria-hidden="true" size={18} />
        Listening...
      </p>
    )
  }

  if (status === 'matched') {
    return (
      <p className="feedback success">
        <Check aria-hidden="true" size={18} />
        You got it.
      </p>
    )
  }

  if (status === 'try-again') {
    return (
      <div className="parent-check">
        <p>{transcript ? `I heard: ${transcript}` : 'I missed that.'}</p>
        <div>
          <button type="button" onClick={onParentCorrect}>
            Count it
          </button>
          <button type="button" onClick={onTryAgain}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  return <p className="feedback muted">Speak clearly.</p>
}

function TimeWorkspace({
  time,
  targetTime,
  result,
  timeWins,
  playbackMessage,
  onTimeChange,
  onAdjustTime,
  onSetPeriod,
  onSetPreset,
  onSetNow,
  onSetRandom,
  onPlayTime,
  onCheckTime
}: {
  time: TimeValue
  targetTime: TimeValue
  result: TimeResult
  timeWins: number
  playbackMessage: string
  onTimeChange: (time: TimeValue) => void
  onAdjustTime: (unit: TimeUnit, delta: number) => void
  onSetPeriod: (period: TimePeriod) => void
  onSetPreset: (minute: number) => void
  onSetNow: () => void
  onSetRandom: () => void
  onPlayTime: () => void
  onCheckTime: () => void
}) {
  return (
    <section className="workspace-view time-view" aria-labelledby="time-title">
      <header className="view-header">
        <div>
          <h1 id="time-title">Time Studio</h1>
          <p>{playbackMessage}</p>
        </div>
        <div className="view-counter">{timeWins} wins</div>
      </header>

      <div className="time-stage">
        <DigitalClock
          time={time}
          onAdjust={onAdjustTime}
          onSetPeriod={onSetPeriod}
          onPlayTime={onPlayTime}
        />
        <AnalogClock
          time={time}
          onChange={onTimeChange}
        />
      </div>

      <section className="time-challenge-panel" aria-labelledby="time-challenge-title">
        <div className="time-target">
          <span className="target-icon" aria-hidden="true">
            <Clock size={24} />
          </span>
          <div>
            <h2 id="time-challenge-title">Match this time</h2>
            <strong>{formatTimeValue(targetTime)}</strong>
          </div>
        </div>
        <div className="time-check-area">
          <button type="button" className="primary-action" onClick={onCheckTime}>
            Check my time
          </button>
          <TimeFeedback result={result} />
        </div>
      </section>

      <div className="time-preset-grid" aria-label="Time shortcuts">
        <button type="button" className="time-preset-button" onClick={onSetNow}>
          <Clock aria-hidden="true" size={20} />
          Now
        </button>
        <button type="button" className="time-preset-button" onClick={onSetRandom}>
          <Shuffle aria-hidden="true" size={20} />
          Random
        </button>
        {TIME_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="time-preset-button"
            onClick={() => onSetPreset(preset.minute)}
            aria-label={`Set ${preset.label}`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function AnalogClock({
  time,
  onChange
}: {
  time: TimeValue
  onChange: (time: TimeValue) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const activeHandRef = useRef<'hour' | 'minute' | null>(null)
  const angles = timeToAngles(time)
  const hourEnd = clockPoint(angles.hourAngle, 82)
  const minuteEnd = clockPoint(angles.minuteAngle, 120)

  const updateFromPointer = (event: ReactPointerEvent<SVGElement>) => {
    const hand = activeHandRef.current
    const svg = svgRef.current
    if (!hand || !svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * CLOCK_SIZE
    const y = ((event.clientY - rect.top) / rect.height) * CLOCK_SIZE
    const angle = pointToClockAngle(x, y, CLOCK_CENTER, CLOCK_CENTER)

    onChange(
      hand === 'minute'
        ? { ...time, minute: angleToMinute(angle) }
        : { ...time, hour: angleToHour(angle, time.minute) }
    )
  }

  const handlePointerDown =
    (hand: 'hour' | 'minute') => (event: ReactPointerEvent<SVGElement>) => {
      activeHandRef.current = hand
      svgRef.current?.setPointerCapture?.(event.pointerId)
      updateFromPointer(event)
    }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activeHandRef.current) {
      updateFromPointer(event)
    }
  }

  const handlePointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    activeHandRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  return (
    <section className="clock-card analog-clock-card" aria-labelledby="analog-clock-title">
      <header className="clock-card-header">
        <div>
          <Clock aria-hidden="true" size={22} />
          <h2 id="analog-clock-title">Analog Clock</h2>
        </div>
        <span className="clock-chip">{formatTimeValue(time)}</span>
      </header>

      <svg
        ref={svgRef}
        className="analog-clock"
        viewBox={`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`}
        role="img"
        aria-label={`Analog clock showing ${formatTimeValue(time)}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <circle className="analog-face" cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={154} />
        {Array.from({ length: 12 }, (_, index) => {
          const angle = index * 30
          const tickStart = clockPoint(angle, 134)
          const tickEnd = clockPoint(angle, 150)
          const label = clockPoint(angle, 112)

          return (
            <g key={index}>
              <line
                className="clock-tick is-hour"
                x1={tickStart.x}
                y1={tickStart.y}
                x2={tickEnd.x}
                y2={tickEnd.y}
              />
              <text className="clock-hour-label" x={label.x} y={label.y}>
                {HOUR_LABELS[index]}
              </text>
            </g>
          )
        })}
        <line
          className="clock-hand hour-hand"
          x1={CLOCK_CENTER}
          y1={CLOCK_CENTER}
          x2={hourEnd.x}
          y2={hourEnd.y}
        />
        <line
          className="clock-hand minute-hand"
          x1={CLOCK_CENTER}
          y1={CLOCK_CENTER}
          x2={minuteEnd.x}
          y2={minuteEnd.y}
        />
        <line
          className="clock-hand-hit"
          role="slider"
          tabIndex={0}
          aria-label="Analog hour hand"
          aria-valuemin={1}
          aria-valuemax={12}
          aria-valuenow={time.hour}
          x1={CLOCK_CENTER}
          y1={CLOCK_CENTER}
          x2={hourEnd.x}
          y2={hourEnd.y}
          onPointerDown={handlePointerDown('hour')}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
              event.preventDefault()
              onChange(addHours(time, 1))
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
              event.preventDefault()
              onChange(addHours(time, -1))
            }
          }}
        />
        <line
          className="clock-hand-hit"
          role="slider"
          tabIndex={0}
          aria-label="Analog minute hand"
          aria-valuemin={0}
          aria-valuemax={59}
          aria-valuenow={time.minute}
          x1={CLOCK_CENTER}
          y1={CLOCK_CENTER}
          x2={minuteEnd.x}
          y2={minuteEnd.y}
          onPointerDown={handlePointerDown('minute')}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
              event.preventDefault()
              onChange(addMinutes(time, 1))
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
              event.preventDefault()
              onChange(addMinutes(time, -1))
            }
          }}
        />
        <circle className="clock-center-dot" cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={9} />
      </svg>
    </section>
  )
}

function clockPoint(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180

  return {
    x: CLOCK_CENTER + Math.sin(radians) * radius,
    y: CLOCK_CENTER - Math.cos(radians) * radius
  }
}

function DigitalClock({
  time,
  onAdjust,
  onSetPeriod,
  onPlayTime
}: {
  time: TimeValue
  onAdjust: (unit: TimeUnit, delta: number) => void
  onSetPeriod: (period: TimePeriod) => void
  onPlayTime: () => void
}) {
  return (
    <section className="clock-card digital-clock-card" aria-labelledby="digital-clock-title">
      <header className="clock-card-header">
        <div>
          <Clock aria-hidden="true" size={22} />
          <h2 id="digital-clock-title">Digital Clock</h2>
        </div>
        <button type="button" className="play-mini" onClick={onPlayTime}>
          <Volume2 aria-hidden="true" size={20} />
          Hear Time
        </button>
      </header>

      <div className="digital-clock-display" aria-label={`Selected time ${formatTimeValue(time)}`}>
        <DigitalTimeUnit
          label="Digital hour"
          value={time.hour}
          displayValue={String(time.hour)}
          min={1}
          max={12}
          onAdjust={(delta) => onAdjust('hour', delta)}
        />
        <span className="digital-colon" aria-hidden="true">
          :
        </span>
        <DigitalTimeUnit
          label="Digital minute"
          value={time.minute}
          displayValue={String(time.minute).padStart(2, '0')}
          min={0}
          max={59}
          onAdjust={(delta) => onAdjust('minute', delta)}
        />
        <span className="digital-period" aria-hidden="true">
          {time.period}
        </span>
      </div>

      <div className="time-step-grid" aria-label="Digital clock controls">
        <TimeStepButton
          label="Decrease hour"
          direction="down"
          onClick={() => onAdjust('hour', -1)}
        />
        <TimeStepButton
          label="Increase hour"
          direction="up"
          onClick={() => onAdjust('hour', 1)}
        />
        <TimeStepButton
          label="Decrease minute"
          direction="down"
          onClick={() => onAdjust('minute', -1)}
        />
        <TimeStepButton
          label="Increase minute"
          direction="up"
          onClick={() => onAdjust('minute', 1)}
        />
      </div>

      <div className="period-toggle" role="group" aria-label="Choose AM or PM">
        {(['AM', 'PM'] as TimePeriod[]).map((period) => (
          <button
            key={period}
            type="button"
            className={time.period === period ? 'is-active' : ''}
            onClick={() => onSetPeriod(period)}
            aria-pressed={time.period === period}
          >
            {period === 'AM' ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
            {period}
          </button>
        ))}
      </div>
    </section>
  )
}

function DigitalTimeUnit({
  label,
  value,
  displayValue,
  min,
  max,
  onAdjust
}: {
  label: string
  value: number
  displayValue: string
  min: number
  max: number
  onAdjust: (delta: number) => void
}) {
  const dragRef = useRef<{ pointerId: number; startY: number; lastStep: number } | null>(null)

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastStep: 0
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const nextStep = Math.trunc((drag.startY - event.clientY) / 16)
    const delta = nextStep - drag.lastStep
    if (delta !== 0) {
      onAdjust(delta)
      drag.lastStep = nextStep
    }
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
  }

  return (
    <div
      className="digital-time-unit"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={displayValue}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
          event.preventDefault()
          onAdjust(1)
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
          event.preventDefault()
          onAdjust(-1)
        }
      }}
    >
      {displayValue}
    </div>
  )
}

function TimeStepButton({
  label,
  direction,
  onClick
}: {
  label: string
  direction: 'up' | 'down'
  onClick: () => void
}) {
  return (
    <button type="button" className="time-step-button" onClick={onClick} aria-label={label}>
      {direction === 'up' ? (
        <Plus aria-hidden="true" size={20} />
      ) : (
        <Minus aria-hidden="true" size={20} />
      )}
    </button>
  )
}

function ClockTeachingPanel({ time }: { time: TimeValue }) {
  const cue = getTimeTeachingCue(time)

  return (
    <section className="clock-card clock-teaching-card" aria-labelledby="clock-words-title">
      <header className="clock-card-header">
        <div>
          <Sparkles aria-hidden="true" size={22} />
          <h2 id="clock-words-title">Clock Words</h2>
        </div>
        <span className="clock-chip">{cue.phrase}</span>
      </header>

      <div className="clock-teaching-grid">
        <TeachingChip label="Hour" value={cue.hourLabel} />
        <TeachingChip label="Minutes" value={cue.minuteLabel} />
        <TeachingChip label="Cue" value={cue.phrase} />
        <TeachingChip label="Say" value={cue.spokenText} />
      </div>
    </section>
  )
}

function TeachingChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="teaching-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TimeFeedback({ result }: { result: TimeResult }) {
  if (result === 'correct') {
    return (
      <p className="feedback success">
        <Check aria-hidden="true" size={18} />
        That matches.
      </p>
    )
  }

  if (result === 'try-again') {
    return (
      <p className="feedback retry">
        <RotateCcw aria-hidden="true" size={18} />
        Move the hands a little more.
      </p>
    )
  }

  return <p className="feedback muted">Set both clocks to the target.</p>
}

function TimeRail({
  time,
  targetTime,
  result,
  onPlayTime,
  onCheckTime
}: {
  time: TimeValue
  targetTime: TimeValue
  result: TimeResult
  onPlayTime: () => void
  onCheckTime: () => void
}) {
  return (
    <aside className="right-rail time-rail" aria-label="Time practice">
      <header className="quiz-header">
        <div>
          <h2>Time Practice</h2>
          <p>Set the clock</p>
        </div>
        <Clock aria-hidden="true" size={26} />
      </header>

      <section className="quiz-block is-focused">
        <div className="status-pill">
          <Clock aria-hidden="true" size={18} />
          Target
        </div>
        <strong className="time-rail-target">{formatTimeValue(targetTime)}</strong>
        <p>Try to make the digital and analog clocks match.</p>
      </section>

      <section className="quiz-block">
        <div className="status-pill turn">
          <Clock aria-hidden="true" size={18} />
          Current
        </div>
        <strong className="time-rail-current">{formatTimeValue(time)}</strong>
        <div className="time-rail-actions">
          <button
            type="button"
            className="sound-button compact"
            onClick={onPlayTime}
            aria-label="Hear time from helper"
          >
            <Volume2 aria-hidden="true" size={34} fill="currentColor" />
          </button>
          <button type="button" className="primary-action" onClick={onCheckTime}>
            Check
          </button>
        </div>
        <TimeFeedback result={result} />
      </section>

      <section className="rail-section">
        <h3>Minute Cues</h3>
        <div className="clock-reference-list">
          {TIME_PRESETS.map((preset) => (
            <div key={preset.label}>
              <strong>{String(preset.minute).padStart(2, '0')}</strong>
              <span>{preset.label}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

function ClockRail({
  time,
  onPlayTime
}: {
  time: TimeValue
  onPlayTime: () => void
}) {
  const cue = getTimeTeachingCue(time)

  return (
    <aside className="right-rail clock-rail" aria-label="Clock helper">
      <header className="quiz-header">
        <div>
          <h2>Clock Helper</h2>
          <p>Minute landmarks</p>
        </div>
        <Clock aria-hidden="true" size={26} />
      </header>

      <section className="quiz-block is-focused">
        <div className="status-pill">
          <Clock aria-hidden="true" size={18} />
          Selected
        </div>
        <strong className="clock-rail-current">{formatTimeValue(time)}</strong>
        <p>{cue.spokenText}</p>
        <button
          type="button"
          className="sound-button compact"
          onClick={onPlayTime}
          aria-label="Hear clock time from helper"
        >
          <Volume2 aria-hidden="true" size={34} fill="currentColor" />
        </button>
      </section>

      <section className="rail-section">
        <h3>Quick Cues</h3>
        <div className="clock-reference-list">
          {CLOCK_PRESETS.map((preset) => (
            <div key={preset.label}>
              <strong>{preset.label}</strong>
              <span>{preset.cue}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

function MoneyRail({
  pieceCount,
  totalCents,
  onAddPiece
}: {
  pieceCount: number
  totalCents: number
  onAddPiece: (denominationId: MoneyDenominationId) => void
}) {
  return (
    <aside className="right-rail money-rail" aria-label="Money helper">
      <header className="quiz-header">
        <div>
          <h2>Money Count</h2>
          <p>{pieceCount} pieces</p>
        </div>
        <div className="medal" aria-label={`Money total ${formatMoneyTotal(totalCents)}`}>
          <Coins aria-hidden="true" size={18} />
          <span>{formatMoneyTotal(totalCents)}</span>
        </div>
      </header>

      <section className="quiz-block is-focused">
        <div className="status-pill">
          <Coins aria-hidden="true" size={18} />
          Total
        </div>
        <strong className="money-rail-total">{formatMoneyTotal(totalCents)}</strong>
        <p>Nickels, dimes, quarters, and bills</p>
      </section>

      <section className="rail-section">
        <h3>Quick Add</h3>
        <div className="money-rail-grid">
          {MONEY_DENOMINATIONS.map((denomination) => (
            <button
              key={denomination.id}
              type="button"
              className={moneyPieceClassName(denomination.kind)}
              onClick={() => onAddPiece(denomination.id)}
              aria-label={`Add ${denomination.label} from helper`}
            >
              <MoneyPieceFace denominationId={denomination.id} compact />
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}

function ProgressRail({
  progress,
  selectedLevel
}: {
  progress: ProgressState
  selectedLevel: PracticeLevel
}) {
  const totalCompleted = Object.values(progress.completed).reduce((sum, count) => sum + count, 0)

  return (
    <aside className="right-rail progress-rail" aria-label="Progress">
      <header className="quiz-header">
        <div>
          <h2>Progress</h2>
          <p>Small wins add up</p>
        </div>
        <div className="medal">
          <Star aria-hidden="true" size={18} fill="currentColor" />
          <span>{totalCompleted}</span>
        </div>
      </header>

      <div className="stat-stack">
        <StatCard label="Listening wins" value={progress.listenWins} />
        <StatCard label="Speaking wins" value={progress.speakWins} />
        <StatCard label="Practice streak" value={progress.streak} />
      </div>

      <section className="rail-section">
        <h3>Current level</h3>
        <p>{selectedLevel.title}</p>
        <strong>{progress.completed[selectedLevel.id] ?? 0} completed</strong>
      </section>
    </aside>
  )
}

function SettingsRail({
  progress,
  voices,
  onSettingsChange,
  onResetProgress
}: {
  progress: ProgressState
  voices: SpeechSynthesisVoice[]
  onSettingsChange: (updates: Partial<ProgressState['settings']>) => void
  onResetProgress: () => void
}) {
  return (
    <aside className="right-rail settings-rail" aria-label="Settings">
      <header className="quiz-header">
        <div>
          <h2>Settings</h2>
          <p>Friendly teacher voice</p>
        </div>
        <Settings aria-hidden="true" size={26} />
      </header>

      <SettingsFields
        progress={progress}
        voices={voices}
        onSettingsChange={onSettingsChange}
        onResetProgress={onResetProgress}
      />
    </aside>
  )
}

function SettingsFields({
  progress,
  voices,
  onSettingsChange,
  onResetProgress
}: {
  progress: ProgressState
  voices: SpeechSynthesisVoice[]
  onSettingsChange: (updates: Partial<ProgressState['settings']>) => void
  onResetProgress: () => void
}) {
  return (
    <div className="settings-fields">
      <label className="field">
        <span>Voice</span>
        <select
          value={progress.settings.voiceURI ?? ''}
          onChange={(event) =>
            onSettingsChange({ voiceURI: event.target.value || undefined })
          }
        >
          <option value="">Best available English voice</option>
          {voices.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Speed</span>
        <input
          type="range"
          min="0.65"
          max="1.15"
          step="0.01"
          value={progress.settings.rate}
          onChange={(event) => onSettingsChange({ rate: Number(event.target.value) })}
        />
      </label>

      <label className="field">
        <span>Pitch</span>
        <input
          type="range"
          min="0.8"
          max="1.3"
          step="0.01"
          value={progress.settings.pitch}
          onChange={(event) => onSettingsChange({ pitch: Number(event.target.value) })}
        />
      </label>

      <button type="button" className="reset-button" onClick={onResetProgress}>
        Reset progress
      </button>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
