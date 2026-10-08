import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject, throwError } from 'rxjs';
import { SpinnerService } from './spinner.service';
import { spinnerInterceptor } from '../interceptors/spinner.interceptor';

describe('SpinnerService', () => {
  let spinner: SpinnerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    spinner = TestBed.inject(SpinnerService);
  });

  it('stays on until every overlapping operation has finished (reference counting)', () => {
    const r1 = spinner.show();
    expect(spinner.isLoading()).toBe(true);
    const r2 = spinner.show();
    spinner.hide(r1);
    expect(spinner.isLoading()).toBe(true);
    spinner.hide(r2);
    expect(spinner.isLoading()).toBe(false);
  });

  it('never goes below zero when hide() is called too often', () => {
    const r = spinner.show();
    spinner.hide(r);
    spinner.hide(r);
    spinner.hide();
    expect(spinner.pending()).toEqual({ blocking: 0, background: 0 });
    spinner.show();
    expect(spinner.isLoading()).toBe(true);
  });

  it('turns off when a tracked observable errors', () => {
    let failed = false;
    spinner.track(throwError(() => new Error('boom'))).subscribe({ error: () => (failed = true) });
    expect(failed).toBe(true);
    expect(spinner.isLoading()).toBe(false);
  });

  it('turns off when a tracked observable is unsubscribed (e.g. navigation away)', () => {
    const s = new Subject<number>();
    const sub = spinner.track(s, { mode: 'background' }).subscribe();
    expect(spinner.pending().background).toBe(1);
    sub.unsubscribe();
    expect(spinner.isLoading()).toBe(false);
  });

  it('separates blocking and background work', () => {
    spinner.show({ mode: 'background' });
    expect(spinner.isBlocking()).toBe(false);
    spinner.show({ mode: 'blocking' });
    expect(spinner.isBlocking()).toBe(true);
  });

  it('releases the ticket of run() even when the promise rejects', async () => {
    await expect(spinner.run(Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(spinner.isLoading()).toBe(false);
  });
});

describe('spinnerInterceptor', () => {
  it('counts concurrent HTTP requests and clears on success and failure', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([spinnerInterceptor])), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    const spinner = TestBed.inject(SpinnerService);

    http.get('/api/a').subscribe();
    http.post('/api/b', {}).subscribe({ error: () => undefined });
    expect(spinner.pending()).toEqual({ blocking: 1, background: 1 });

    ctrl.expectOne('/api/a').flush({ ok: true });
    expect(spinner.isLoading()).toBe(true);
    ctrl.expectOne('/api/b').flush('fail', { status: 500, statusText: 'Server Error' });
    expect(spinner.isLoading()).toBe(false);
    ctrl.verify();
  });
});
