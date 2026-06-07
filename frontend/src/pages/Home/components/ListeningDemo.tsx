import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/utils/i18n';
import './ListeningDemo.css';

type DemoMessage = {
  id: string;
  side: 'me' | 'them';
  text: string;
  time?: string;
};

type DemoNote = {
  id: string;
  at: number;
  label: string;
  text: string;
  emphasis: string;
};

const AUTO_ADVANCE_MS = 1800;
const INITIAL_FRAME = 1;

function getMessages(): DemoMessage[] {
  return [
    { id: 'm1', side: 'me', text: t('listeningDemo.message1') },
    { id: 'm2', side: 'them', text: t('listeningDemo.message2') },
    { id: 'm3', side: 'them', text: t('listeningDemo.message3') },
    { id: 'm4', side: 'me', text: t('listeningDemo.message4'), time: t('listeningDemo.time1') },
    { id: 'm5', side: 'me', text: t('listeningDemo.message5') },
    { id: 'm6', side: 'them', text: t('listeningDemo.message6'), time: t('listeningDemo.time2') },
    { id: 'm7', side: 'them', text: t('listeningDemo.message7') },
    { id: 'm8', side: 'me', text: t('listeningDemo.message8') },
    { id: 'm9', side: 'them', text: t('listeningDemo.message9'), time: t('listeningDemo.time3') },
    { id: 'm10', side: 'me', text: t('listeningDemo.message10') },
    { id: 'm11', side: 'me', text: t('listeningDemo.message11') },
    { id: 'm12', side: 'them', text: t('listeningDemo.message12'), time: t('listeningDemo.time4') },
  ];
}

function getNotes(): DemoNote[] {
  return [
    {
      id: 'n1',
      at: 5,
      label: t('listeningDemo.note1.label'),
      text: t('listeningDemo.note1.text'),
      emphasis: t('listeningDemo.note1.emphasis'),
    },
    {
      id: 'n2',
      at: 6,
      label: t('listeningDemo.note2.label'),
      text: t('listeningDemo.note2.text'),
      emphasis: t('listeningDemo.note2.emphasis'),
    },
    {
      id: 'n3',
      at: 9,
      label: t('listeningDemo.note3.label'),
      text: t('listeningDemo.note3.text'),
      emphasis: t('listeningDemo.note3.emphasis'),
    },
    {
      id: 'n4',
      at: 12,
      label: t('listeningDemo.note4.label'),
      text: t('listeningDemo.note4.text'),
      emphasis: t('listeningDemo.note4.emphasis'),
    },
  ];
}

const ListeningDemo = () => {
  const messages = useMemo(getMessages, []);
  const notes = useMemo(getNotes, []);
  const threadRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(INITIAL_FRAME);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return undefined;

    const timer = window.setInterval(() => {
      setFrame((current) => {
        if (current >= messages.length) return INITIAL_FRAME;
        return current + 1;
      });
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [messages.length, playing]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    if (typeof thread.scrollTo === 'function') {
      thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
      return;
    }
    thread.scrollTop = thread.scrollHeight;
  }, [frame]);

  const noticedCount = notes.filter((note) => note.at <= frame).length;

  return (
    <section className="listening-demo-section" aria-labelledby="listening-demo-title">
      <div className="listening-demo-header">
        <p className="listening-demo-eyebrow">{t('listeningDemo.eyebrow')}</p>
        <div className="listening-demo-heading-row">
          <h2 id="listening-demo-title" className="listening-demo-title">{t('listeningDemo.title')}</h2>
          <p className="listening-demo-subtitle">{t('listeningDemo.subtitle')}</p>
        </div>
      </div>

      <div className="listening-demo-stage">
        <div className="conversation-phone" aria-label={t('listeningDemo.chatAria')}>
          <div className="conversation-topbar">
            <div className="conversation-avatar" aria-hidden="true">J</div>
            <div>
              <div className="conversation-name">{t('listeningDemo.chatName')}</div>
              <div className="conversation-status">{t('listeningDemo.chatStatus')}</div>
            </div>
          </div>

          <div ref={threadRef} className="conversation-thread">
            {messages.slice(0, frame).map((message) => {
              return (
                <div key={message.id} className={`conversation-row ${message.side} visible`}>
                  {message.time ? <div className="conversation-time">{message.time}</div> : null}
                  <div className="conversation-bubble">{message.text}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="listening-notes" aria-label={t('listeningDemo.notesAria')}>
          {notes.map((note) => {
            const visible = note.at <= frame;
            return (
              <article key={note.id} className={`listening-note ${visible ? 'visible' : 'pending'}`} aria-hidden={!visible}>
                <div className="listening-note-dot" aria-hidden="true" />
                {visible ? (
                  <>
                    <div className="listening-note-label">
                      <Sparkles className="size-4" aria-hidden="true" />
                      <span>{note.label}</span>
                    </div>
                    <p>
                      {note.text}
                      <strong>{note.emphasis}</strong>
                    </p>
                  </>
                ) : (
                  <div className="listening-note-placeholder" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <div className="listening-controls">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="listening-play-button"
          onClick={() => setPlaying((current) => !current)}
          aria-label={playing ? t('listeningDemo.pause') : t('listeningDemo.play')}
        >
          {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        </Button>
        <input
          className="listening-scrubber"
          type="range"
          min={1}
          max={messages.length}
          value={frame}
          onChange={(event) => {
            setPlaying(false);
            setFrame(Number(event.target.value));
          }}
          aria-label={t('listeningDemo.scrubber')}
        />
        <div className="listening-count">
          {t('listeningDemo.count')
            .replace('{messages}', String(frame))
            .replace('{noticed}', String(noticedCount))}
        </div>
      </div>
    </section>
  );
};

export default ListeningDemo;
