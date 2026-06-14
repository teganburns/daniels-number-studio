import {
  BarChart3,
  Check,
  ChevronRight,
  Delete,
  Ear,
  Home,
  Keyboard,
  Mic,
  Pencil,
  Play,
  RotateCcw,
  Settings,
  Share2,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PRACTICE_LEVELS, PracticeLevel, getNextSample } from './data/practice'
import { speechMatchesNumber } from './lib/match'
import { ParsedNumber, parseNumberInput } from './lib/numberWords'
import {
  DEFAULT_PROGRESS,
  ProgressState,
  loadProgress,
  recordListenWin,
  recordSpeakWin,
  saveProgress,
  updateSpeechSettings
} from './lib/progress'
import {
  browserSpeechProvider,
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported
} from './lib/speech'

type NavId = 'learn' | 'listen' | 'speak' | 'progress' | 'settings'
type ListenResult = 'idle' | 'correct' | 'try-again'
type SpeakStatus = 'idle' | 'listening' | 'matched' | 'try-again' | 'unsupported'

type NavItem = {
  id: NavId
  label: string
  icon: LucideIcon
}

const INITIAL_INPUT = '42105.37'

const NAV_ITEMS: NavItem[] = [
  { id: 'learn', label: 'Learn', icon: Home },
  { id: 'listen', label: 'Listen', icon: Ear },
  { id: 'speak', label: 'Speak', icon: Mic },
  { id: 'progress', label: 'Progress', icon: BarChart3 }
]

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ',', '.', '00', '000']

export default function App() {
  const [activeNav, setActiveNav] = useState<NavId>('learn')
  const [numberInput, setNumberInput] = useState(INITIAL_INPUT)
  const [selectedLevelId, setSelectedLevelId] = useState('decimals')
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [playbackMessage, setPlaybackMessage] = useState('Ready to practice')
  const [listenAnswer, setListenAnswer] = useState('')
  const [listenResult, setListenResult] = useState<ListenResult>('idle')
  const [speakStatus, setSpeakStatus] = useState<SpeakStatus>('idle')
  const [speakTranscript, setSpeakTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

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
