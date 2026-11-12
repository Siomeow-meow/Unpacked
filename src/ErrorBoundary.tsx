/* If a page crashes, show what happened (and a way out) instead of a blank screen. */
import { Component, type ReactNode } from 'react';

interface State { error: Error | null; asking: boolean }

export function clearAppData(): void {
    try { Object.keys(localStorage).filter(k => k.startsWith('unpacked:') || k.startsWith('simplex-tutor:')).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
}
export async function clearCaches(): Promise<void> {
    try { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs || []).map(r => r.unregister())); } catch { /* ignore */ }
    try { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } catch { /* ignore */ }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
    state: State = { error: null, asking: false };
    static getDerivedStateFromError(error: Error): Partial<State> { return { error }; }
    componentDidCatch(error: Error) { console.error('Unpacked crashed:', error); document.documentElement.classList.remove('booting'); }
    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="app" style={{ display: 'block', padding: 24, maxWidth: 620 }}>
                <h2 style={{ marginTop: '8vh' }}>Something went wrong</h2>
                <p className="muted">Unpacked hit an error and stopped this page instead of showing a blank screen.</p>
                <pre className="dout" style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>{String(this.state.error.message || this.state.error)}</pre>
                <div className="row gap" style={{ flexWrap: 'wrap' }}>
                    <button className="btn primary" type="button" onClick={() => location.reload()}>Reload</button>
                    <button className="btn" type="button" onClick={async () => { await clearCaches(); location.reload(); }}>Clear the offline cache and reload</button>
                    {!this.state.asking && <button className="btn" type="button" onClick={() => this.setState({ asking: true })}>Reset my data</button>}
                </div>
                {this.state.asking && (
                    <div className="pask" role="alertdialog" aria-label="Delete your saved data?" style={{ marginTop: 12 }}>
                        <span>This deletes your saved problems and progress in this browser. Continue?</span>
                        <button className="btn small" type="button" autoFocus onClick={() => { clearAppData(); location.hash = '#/'; location.reload(); }}>Yes, delete</button>
                        <button className="btn small" type="button" onClick={() => this.setState({ asking: false })}>Cancel</button>
                    </div>
                )}
            </div>
        );
    }
}
