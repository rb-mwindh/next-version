import { GitRepo } from './git-repo.js';

describe('GitRepo basic functionality', () => {
  const repo = new GitRepo({ initialBranch: 'main' });

  beforeEach(async () => {
    await repo.init();
  });

  afterAll(async () => {
    await repo.teardown();
  });

  it('can create a file', async () => {
    await repo.editFile('foo.txt', () => 'hello');
    await repo.commit('feat: add foo');
    const fooContent = repo.readFile('foo.txt');
    expect(fooContent).toBe('hello');
  });

  it('can edit a file', async () => {
    await repo.editFile('foo.txt', 'hello');
    await repo.commit('feat: initial commit');
    await repo.editFile('foo.txt', 'hello world');
    await repo.commit('feat: edit foo');
    const fooContent = repo.readFile('foo.txt');
    expect(fooContent).toBe('hello world');
  });

  it('can commit changes', async () => {
    await repo.editFile('foo.txt', 'hello');
    await repo.commit('feat: initial commit');
    await repo.editFile('foo.txt', 'hello world');
    await repo.commit('feat: add foo');
    const log = await repo.git.log();
    expect(log.latest?.message).toBe('feat: add foo');
  });

  it('can tag a commit', async () => {
    await repo.editFile('foo.txt', 'hello');
    await repo.commit('feat: initial commit');
    await repo.commit('feat: add foo', { allowEmpty: true });
    await repo.tag('v1.0.0', { message: 'release'});
    const tags = await repo.git.tags();
    expect(tags.all).toContain('v1.0.0');
  });

  it('can delete a file', async () => {
    await repo.editFile('foo.txt', 'hello');
    await repo.commit('feat: initial commit');
    await repo.editFile('foo.txt');
    await repo.commit('feat: delete foo.txt');
    await repo.push();
    expect(() => repo.readFile('foo.txt')).toThrow();
  });
});
