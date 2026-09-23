import { useMemo, useRef, useState, useEffect } from 'react';
import { MIN_TRAIN, MAX_ROUNDS, fixFor, minToAdd, ruleFrom } from './shared/lesson.js';
import { MattySays } from './components/Matty.jsx';
import Progress from './components/Progress.jsx';
import PhotoGrid, { photoSrc } from './components/PhotoGrid.jsx';

const STAGE_OF = {
  collect: 0, declare: 2, discuss: 3, reveal: 4, fix: 5, learned: 6,
  test: 7, testResult: 7, leakage: 7, fair: 8, fairResult: 8, wrap: 8,
};

export default function Lesson({ tier, manifest, backend, objectType, onRestart }) {
  const live = tier === 'tier1';
  const byId = useMemo(() => Object.fromEntries(manifest.photos.map((p) => [p.id, p])), [manifest]);
  const group = (g) => manifest.photos.filter((p) => p.group === g);

  // Tier 2 starts with its preloaded training set already in place.
  const [trainIds, setTrainIds] = useState(live ? [] : manifest.tier2.train);
  const [addedIds, setAddedIds] = useState([]);
  const [applied, setApplied] = useState({ clean: false, diversify: false });
  const [phase, setPhase] = useState('collect');
  const [thinking, setThinking] = useState(null); // 'analyze' | 'retrain' | 'test' | null
  const [round, setRound] = useState(1);
  const [history, setHistory] = useState([]);    // analyses, in order
  const [fix, setFix] = useState(null);
  const [testRun, setTestRun] = useState(null);  // { id, result }
  const [fairRun, setFairRun] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(null);
  const [picked, setPicked] = useState(live ? [] : manifest.tier2.diverse); // "more variety" choices
  const [leakAnswer, setLeakAnswer] = useState(null);

  const analysis = history[history.length - 1];
  const studied = [...trainIds, ...addedIds];
  const state = { clean: applied.clean, diverse: applied.diversify };
  const heldout = live ? group('heldout') : manifest.tier2.heldout.map((id) => byId[id]);
  const photos = (ids) => ids.map((id) => byId[id]).filter(Boolean);

  const top = useRef(null);
  useEffect(() => { top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [phase, thinking]);

  async function run(kind, fn) {
    setError(null);
    setThinking(kind);
    try { await fn(); setRetry(null); }
    catch (e) { setError(e.message); setRetry(() => () => run(kind, fn)); }
    finally { setThinking(null); }
  }

  function study() {
    const firstTime = history.length === 0;
    run(firstTime ? 'analyze' : 'retrain', async () => {
      const a = await backend.analyze(studied, state);
      setHistory((h) => [...h, a]);
      const canFixAgain = fixFor(a, applied) !== null;
      if (a.reliesOnShortcut && (firstTime || (round < MAX_ROUNDS && canFixAgain))) {
        if (!firstTime) setRound((r) => r + 1);
        setPhase('declare');
      } else {
        setPhase('learned');
      }
    });
  }

  function startFix() {
    const f = fixFor(analysis, applied);
    if (!f) { setPhase('learned'); return; }
    setFix(f);
    setPhase('fix');
  }

  function test(id, which) {
    const rule = ruleFrom(analysis);
    run('test', async () => {
      const result = await backend.test(id, state, rule);
      if (which === 'test') { setTestRun({ id, result }); setPhase('testResult'); }
      else { setFairRun({ id, result }); setPhase('fairResult'); }
    });
  }

  const stage = thinking === 'analyze' ? 1 : thinking === 'retrain' ? 6 : STAGE_OF[phase];

  return (
    <main className="lesson" ref={top}>
      <Progress at={stage} round={round} />
      <section className="sheet">
        {thinking ? (
          <Thinking kind={thinking} n={studied.length} />
        ) : error ? (
          <div>
            <MattySays mood="sad">Something went wrong, so I couldn't finish.</MattySays>
            <p className="error">{error}</p>
            <div className="actions">
              {retry && <button className="btn" onClick={retry}>Try again</button>}
              <button className="btn ghost" onClick={() => setError(null)}>Go back</button>
            </div>
          </div>
        ) : (
          screen()
        )}
      </section>
    </main>
  );

  function screen() {
    switch (phase) {
      case 'collect': return live ? (
        <>
          <h2>Show Matty some pens</h2>
          <p>With your partner, tap at least {MIN_TRAIN} photos. Take turns choosing. Every photo here is labeled "pen".</p>
          <PhotoGrid photos={group('train')} selected={trainIds}
            onToggle={(id) => setTrainIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
          <div className="actions">
            <button className="btn" disabled={trainIds.length < MIN_TRAIN} onClick={study}>
              Teach Matty ({trainIds.length} chosen)
            </button>
            {trainIds.length < MIN_TRAIN && <span className="muted">Choose {MIN_TRAIN - trainIds.length} more</span>}
          </div>
        </>
      ) : (
        <>
          <h2>These are Matty's pens</h2>
          <p>Before Matty studies them, look closely with your group. Besides being pens, what do they all have in common?</p>
          <PhotoGrid photos={photos(trainIds)} />
          <div className="actions"><button className="btn" onClick={study}>Teach Matty</button></div>
        </>
      );

      case 'declare': {
        const count = analysis.hasFeature.filter(Boolean).length;
        return (
          <>
            <MattySays mood="confident">
              {round > 1 ? 'OK, new idea! ' : 'I figured it out! '}<strong>{analysis.mattyRule}</strong>
            </MattySays>
            <p className="finding">Matty noticed <mark>{analysis.featureLabel}</mark> in {count} of {analysis.hasFeature.length} pens.</p>
            <PhotoGrid photos={photos(analysis.ids)} clean={applied.clean}
              marks={analysis.hasFeature.map((on) => ({ on, text: on ? analysis.featureLabel : 'no' }))} />
            <div className="actions"><button className="btn" onClick={() => setPhase('discuss')}>Is Matty right?</button></div>
          </>
        );
      }

      case 'discuss': return (
        <>
          <h2 className="question">Is Matty really learning what a pen is, or did it just find a shortcut?</h2>
          <p>Talk it over with your partner. Could something be "{analysis.featureLabel}" and not be a pen? Could a pen not be "{analysis.featureLabel}"?</p>
          <div className="actions"><button className="btn" onClick={() => setPhase('reveal')}>Show Matty a tricky pen</button></div>
        </>
      );

      case 'reveal': return (
        <>
          <div className="counter">
            <span className="counter-label">Matty, what about this one?</span>
            <p>{analysis.counterexample}</p>
          </div>
          <MattySays mood="confused">
            Wait… that one doesn't have {analysis.featureLabel}. So by my rule it's NOT a pen?! But it's obviously a pen…
          </MattySays>
          <p>Matty learned <mark>{analysis.featureLabel}</mark>, not pens. When a model latches onto something that just happens to show up with the right answer, that's called a <strong>spurious correlation</strong>.</p>
          <p className="tip">Facilitator: hold up a real pen like the one described.</p>
          <div className="actions"><button className="btn" onClick={startFix}>Help Matty</button></div>
        </>
      );

      case 'fix': return fix === 'clean' ? fixClean() : fixDiversify();

      case 'learned': {
        const rule = ruleFrom(analysis);
        const first = history[0];
        const retrained = history.length > 1;
        return (
          <>
            {rule.kind === 'object' ? (
              <MattySays mood="proud">{retrained ? 'Now I get it! ' : ''}<strong>{rule.statement}</strong></MattySays>
            ) : (
              <MattySays mood="confident">I'm sure now: <strong>{rule.statement}</strong></MattySays>
            )}
            {retrained && (
              <div className="compare">
                <div><span className="k">Before</span><span><mark>{first.featureLabel}</mark> in {pct(first)} pens</span></div>
                <div><span className="k">Now</span><span>strongest shortcut, <mark>{analysis.featureLabel}</mark>, in {pct(analysis)} pens</span></div>
              </div>
            )}
            {rule.kind === 'object'
              ? <p>No shortcut shows up often enough anymore, so Matty has to use what really makes a pen a pen.</p>
              : <p>Matty is still leaning on a shortcut. Let's see what happens when we test it.</p>}
            <div className="actions"><button className="btn" onClick={() => setPhase('test')}>Test Matty</button></div>
          </>
        );
      }

      case 'test': return (
        <>
          <MattySays mood="confident">Test me! Pick any pen from the ones I studied. I'll get it right.</MattySays>
          <PhotoGrid photos={photos(trainIds)} clean={applied.clean} onToggle={(id) => test(id, 'test')} />
        </>
      );

      case 'testResult': return (
        <>
          {verdict(testRun)}
          <div className="actions"><button className="btn" onClick={() => setPhase('leakage')}>Next</button></div>
        </>
      );

      case 'leakage': return leakage();

      case 'fair': return (
        <>
          <h2>A fair test</h2>
          <p>Matty has never seen any of these pens. {applied.clean && 'They get the same background erasing the training photos got. '}Pick one.</p>
          <PhotoGrid photos={heldout} clean={applied.clean} onToggle={(id) => test(id, 'fair')} />
        </>
      );

      case 'fairResult': {
        const ok = fairRun.result.matches;
        return (
          <>
            {verdict(fairRun)}
            <p>{ok ? 'Matty passed a test on a pen it had never seen. That tells us much more than the first test did.'
              : 'Matty failed on a new pen. The first test made Matty look smart, but only a fair test shows whether the rule really works.'}</p>
            <div className="actions">
              {ok || heldout.length < 2
                ? <button className="btn" onClick={() => setPhase('wrap')}>Finish</button>
                : <>
                  <button className="btn" onClick={() => setPhase('wrap')}>Finish</button>
                  <button className="btn ghost" onClick={() => setPhase('fair')}>Try another new pen</button>
                </>}
            </div>
          </>
        );
      }

      case 'wrap': return (
        <>
          <h2>What happened to Matty</h2>
          <ol className="story">
            {history.map((a, i) => (
              <li key={i}>
                {i === 0 ? 'First try' : `After fix ${i}`}: {a.reliesOnShortcut
                  ? <>relied on <mark>{a.featureLabel}</mark> ({pct(a)} pens)</>
                  : <>no strong shortcut left (top one, {a.featureLabel}, in {pct(a)} pens)</>}
              </li>
            ))}
            {testRun && <li>Test on a pen it studied: {testRun.result.matches ? 'right' : 'wrong'} (not a fair test)</li>}
            {fairRun && <li>Fair test on a new pen: {fairRun.result.matches ? 'right' : 'wrong'}</li>}
          </ol>
          <p className="takeaway">A model can look smart for the wrong reason. Give it varied examples, erase the distractions, and always test it on something new.</p>
          <div className="actions"><button className="btn" onClick={onRestart}>Start over</button></div>
        </>
      );

      default: return null;
    }
  }

  function fixClean() {
    const erased = applied.clean;
    return (
      <>
        <h2>Fix it: erase the background</h2>
        <p>"{analysis.featureLabel}" is around the pen, not part of it. If we erase everything except the pen, Matty can't use it as a shortcut. Cleaning up data before a model studies it is called <strong>preprocessing</strong>.</p>
        <PhotoGrid photos={photos(studied)} clean={erased} wipe />
        <div className="actions">
          {!erased
            ? <button className="btn" onClick={() => setApplied((a) => ({ ...a, clean: true }))}>Erase the backgrounds</button>
            : <button className="btn" onClick={study}>Teach Matty again</button>}
        </div>
      </>
    );
  }

  function fixDiversify() {
    const need = live ? minToAdd(trainIds.length) : manifest.tier2.diverse.length;
    const options = live ? group('diverse') : photos(manifest.tier2.diverse);
    const done = applied.diversify;
    return (
      <>
        <h2>Fix it: show Matty more kinds of pens</h2>
        <p>You can't erase "{analysis.featureLabel}", because it's part of the pen itself. Instead, give Matty pens that don't all look the same. This is called adding <strong>variety</strong> to the data.</p>
        {live && !done && <p>Pick at least {need} pens that are different from the ones Matty already has.</p>}
        {applied.clean && <p className="muted">New photos get the same background erasing as the others.</p>}
        <PhotoGrid photos={options} clean={applied.clean} selected={picked}
          onToggle={live && !done ? (id) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])) : undefined} />
        <div className="actions">
          {!done
            ? <button className="btn" disabled={picked.length < need}
                onClick={() => { setAddedIds(picked); setApplied((a) => ({ ...a, diversify: true })); }}>
                Add {picked.length} pen{picked.length === 1 ? '' : 's'} to Matty's set
              </button>
            : <button className="btn" onClick={study}>Teach Matty again ({studied.length} pens)</button>}
        </div>
      </>
    );
  }

  function leakage() {
    const answer = leakAnswer;
    const setAnswer = setLeakAnswer;
    const got = testRun.result.matches;
    return (
      <>
        <h2 className="question">{got ? 'Matty got it right.' : 'Matty got it wrong, even on a pen it studied.'} But Matty had already seen that exact photo. Was that a fair test?</h2>
        {!answer ? (
          <div className="actions">
            <button className="btn ghost" onClick={() => setAnswer('yes')}>Yes, fair</button>
            <button className="btn ghost" onClick={() => setAnswer('no')}>No, not fair</button>
          </div>
        ) : (
          <>
            <p><strong>{answer === 'no' ? 'Right, it wasn\'t fair.' : 'Not quite.'}</strong> Testing a model on something it already studied is like seeing the answers before a quiz. The score looks great but tells you nothing. This mistake is called <strong>data leakage</strong>.</p>
            <div className="actions"><button className="btn" onClick={() => setPhase('fair')}>Test on a brand-new pen</button></div>
          </>
        )}
      </>
    );
  }

  function verdict(run) {
    const p = byId[run.id];
    const ok = run.result.matches;
    return (
      <div className="verdict">
        <img src={photoSrc(p, applied.clean)} alt="The test photo" />
        <div>
          <MattySays mood={ok ? 'proud' : 'confused'} small>{ok ? "That's a pen!" : "That's not a pen."}</MattySays>
          <p className={`result ${ok ? 'right' : 'wrong'}`}>{ok ? 'Correct. It is a pen.' : 'Wrong. It is a pen.'}</p>
          <p className="muted">What Matty checked: {run.result.why}</p>
        </div>
      </div>
    );
  }
}

function pct(a) {
  return `${a.hasFeature.filter(Boolean).length} of ${a.hasFeature.length}`;
}

function Thinking({ kind, n }) {
  const text = kind === 'test' ? 'Checking this pen against my rule…'
    : kind === 'retrain' ? `Studying all ${n} pens again…` : `Studying ${n} pens… what do they have in common?`;
  return <div className="thinking"><MattySays mood="thinking">{text}</MattySays></div>;
}
