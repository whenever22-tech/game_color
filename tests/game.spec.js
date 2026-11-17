import { readFile } from 'node:fs/promises';
import {test,expect} from '@playwright/test';
test.use({hasTouch:true});
async function differentTile(page){
  const colors=await page.locator('.tile').evaluateAll(tiles=>tiles.map(t=>t.style.backgroundColor));
  const index=colors.findIndex(color=>colors.filter(c=>c===color).length===1);
  expect(index).toBeGreaterThanOrEqual(0);
  return page.locator('.tile').nth(index);
}
test('정답, 오답, 난이도, 시간 종료, 최고 기록과 재시작',async({page})=>{
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.tile')).toHaveCount(4);
  await expect(page.locator('.tile').first()).toBeDisabled();
  await page.getByRole('button',{name:'게임 시작하기'}).click();
  const right=await differentTile(page);
  const rightColor=await right.evaluate(t=>t.style.backgroundColor);
  const wrongIndex=await page.locator('.tile').evaluateAll((ts,color)=>ts.findIndex(t=>t.style.backgroundColor!==color),rightColor);
  await page.locator('.tile').nth(wrongIndex).click();
  await expect(page.locator('#score')).toHaveText('0점');
  await expect(page.locator('#feedback')).toContainText('다시');
  for(let i=0;i<4;i++) await (await differentTile(page)).click();
  await expect(page.locator('#score')).toHaveText('4점');
  await expect(page.locator('.tile')).toHaveCount(9);
  await page.clock.fastForward(30001);
  await expect(page.locator('#time')).toHaveText('0초');
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#overlay-copy')).toContainText('4개');
  await expect(page.locator('#best')).toHaveText('4점');
  await expect(page.locator('.tile').first()).toBeDisabled();
  await page.reload();
  await expect(page.locator('#best')).toHaveText('4점');
  await page.getByRole('button',{name:'게임 시작하기'}).click();
  await expect(page.locator('#score')).toHaveText('0점');
  await expect(page.locator('.tile')).toHaveCount(4);
  await page.clock.fastForward(30001);
  await page.getByRole('button',{name:'다시 시작하기'}).click();
  await expect(page.locator('#time')).toHaveText('30초');
  await expect(page.locator('#overlay')).toBeHidden();
});
test('모바일 터치와 가로 넘침 없음',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('어디가 다를까?');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'게임 시작하기'}).click();
  await (await differentTile(page)).tap();
  await expect(page.locator('#score')).toHaveText('1점');
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('저장소 접근이 차단되어도 플레이 가능',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})});
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button',{name:'게임 시작하기'}).click();
  await (await differentTile(page)).click();
  await page.clock.fastForward(30001);
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#best')).toHaveText('1점');
});
test('데스크톱 화면과 외부 요청 없음',async({page})=>{
  const external=[];
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:3000')) external.push(r.url());});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  await expect(page.getByRole('button',{name:'게임 시작하기'})).toBeVisible();
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  expect(external).toEqual([]);
});

test('하위 폴더에서도 상대 경로로 스타일과 일반 스크립트 로드',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();
  await page.route('**/download/game/*',async route=>{
    const file=new URL(route.request().url()).pathname.split('/').pop();
    if(!['index.html','style.css','game.js'].includes(file)){await route.abort();return;}
    const contentType=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript';
    await route.fulfill({body:await readFile(new URL('../'+file,import.meta.url)),contentType});
  });
  await page.goto('/download/game/index.html');
  await expect(page.locator('script')).toHaveAttribute('defer','');
  await expect(page.locator('script')).not.toHaveAttribute('type','module');
  await expect(page.locator('.game-card')).toHaveCSS('border-radius','25px');
  await page.getByRole('button',{name:'게임 시작하기'}).click();
  await (await differentTile(page)).click();
  await expect(page.locator('#score')).toHaveText('1점');
  await page.clock.fastForward(30001);
  await expect(page.locator('#overlay')).toBeVisible();
  await page.getByRole('button',{name:'다시 시작하기'}).click();
  await expect(page.locator('#score')).toHaveText('0점');
  expect(errors).toEqual([]);
});

async function startFrozen(page){
  const now=new Date('2030-01-01T00:00:00Z');
  await page.clock.install({time:now});
  await page.clock.pauseAt(new Date(now.getTime()+1000));
  await page.goto('/');
  await page.getByRole('button',{name:'게임 시작하기'}).click();
}
async function wrongTile(page){
  const colors=await page.locator('.tile').evaluateAll(ts=>ts.map(t=>t.style.backgroundColor));
  const index=colors.findIndex(c=>colors.filter(x=>x===c).length>1);
  await page.locator('.tile').nth(index).click();
}
test('5연속 +3초, 이후 5의 배수 +2초와 그 외 +0.5초, 콤보는 5의 배수에서만 표시',async({page})=>{
  await startFrozen(page);
  const expectedSeconds=[30,30,30,30,33,33.5,34,34.5,35,37,37.5,38,38.5,39,41,41.5,42,42.5,43,45];
  for(let n=1;n<=20;n++){
    await (await differentTile(page)).click();
    await expect(page.locator('#time')).toHaveText(`${expectedSeconds[n-1]}초`);
    if(n%5===0) await expect(page.locator('#combo')).toHaveText(`✦ ${n} COMBO! +${n===5?3:2}초`);
    else await expect(page.locator('#combo')).toBeHidden();
  }
  expect(await page.locator('#timer-fill').evaluate(t=>t.getBoundingClientRect().width<=t.parentElement.getBoundingClientRect().width)).toBe(true);
  await page.clock.runFor(1401);
  await expect(page.locator('#combo')).toBeHidden();
  await page.clock.runFor(45000);
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#time')).toHaveText('0초');
});
test('오답과 재시작 시 연속 기록 초기화, 만료 후 보너스 없음',async({page})=>{
  await startFrozen(page);
  for(let n=0;n<5;n++) await (await differentTile(page)).click();
  await expect(page.locator('#time')).toHaveText('33초');
  await wrongTile(page);
  await expect(page.locator('#combo')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('5점');
  await expect(page.locator('#time')).toHaveText('33초');
  for(let n=0;n<4;n++) await (await differentTile(page)).click();
  await expect(page.locator('#time')).toHaveText('33초');
  await expect(page.locator('#combo')).toBeHidden();
  await (await differentTile(page)).click();
  await expect(page.locator('#combo')).toHaveText('✦ 5 COMBO! +3초');
  await expect(page.locator('#time')).toHaveText('36초');
  await page.clock.runFor(36001);
  await page.getByRole('button',{name:'다시 시작하기'}).click();
  for(let n=0;n<4;n++) await (await differentTile(page)).click();
  await expect(page.locator('#time')).toHaveText('30초');
  await expect(page.locator('#combo')).toBeHidden();
  const target=await differentTile(page);
  await page.clock.runFor(30001);
  await target.dispatchEvent('click');
  await expect(page.locator('#time')).toHaveText('0초');
  await expect(page.locator('#score')).toHaveText('4점');
});
test('원래 난이도로 4점마다 타일 증가, 색 차이 완만히 감소, 모바일 터치 가능',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.addInitScript(()=>{Math.random=()=>.5;});
  await startFrozen(page);
  async function colorGap(){
    return page.locator('.tile').evaluateAll(ts=>{
      const colors=[...new Set(ts.map(t=>t.style.backgroundColor))].map(c=>c.match(/[\d.]+/g).map(Number));
      return Math.max(...colors[0].map((n,i)=>Math.abs(n-colors[1][i])));
    });
  }
  const initial=await colorGap();
  for(let score=1;score<=16;score++){
    await (await differentTile(page)).tap();
    await expect(page.locator('.tile')).toHaveCount(Math.min(6,2+Math.floor(score/4))**2);
    await differentTile(page); // 가장 어려운 단계에도 정답이 정확히 하나 존재
    if(score===16){
      expect(await colorGap()).toBeGreaterThan(initial*.5);
      expect(await colorGap()).toBeLessThan(initial*.7);
    }
  }
  const tile=await page.locator('.tile').first().boundingBox();
  expect(tile.width).toBeGreaterThanOrEqual(36);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/mobile-hard.png',fullPage:true});
});

test('한 문제 3회 오답 시 실제 정답을 공개하고 입력을 잠근 뒤 점수 없이 다음 문제로 이동',async({page})=>{
  await startFrozen(page);
  const answer=await differentTile(page);
  const originalBoard=await answer.elementHandle();
  const answerName=await answer.getAttribute('aria-label');
  await wrongTile(page);
  await wrongTile(page);
  await expect(page.locator('.answer-reveal')).toHaveCount(0);
  await expect(page.locator('#feedback')).toContainText('2/3');
  await wrongTile(page);
  await expect(page.locator('.answer-reveal')).toHaveAttribute('aria-label',`${answerName}, 정답`);
  await expect(page.locator('#feedback')).toContainText('정답은');
  expect(await page.locator('.tile').evaluateAll(ts=>ts.every(t=>t.disabled))).toBe(true);
  await answer.dispatchEvent('click');
  await expect(page.locator('#score')).toHaveText('0점');
  await expect(page.locator('#time')).toHaveText('30초');
  await page.clock.runFor(1199);
  await expect(page.locator('.answer-reveal')).toHaveCount(1);
  await page.clock.runFor(1);
  await expect(page.locator('.answer-reveal')).toHaveCount(0);
  expect(await originalBoard.evaluate(t=>t.isConnected)).toBe(false);
  await expect(page.locator('#score')).toHaveText('0점');
  await expect(page.locator('#time')).toHaveText('28.8초');
  await expect(page.locator('.tile')).toHaveCount(4);
  await expect(page.locator('.tile').first()).toBeEnabled();
  await wrongTile(page);
  await expect(page.locator('#feedback')).toContainText('1/3');
  await wrongTile(page);
  await (await differentTile(page)).click();
  await wrongTile(page);
  await wrongTile(page);
  await expect(page.locator('.answer-reveal')).toHaveCount(0);
  await expect(page.locator('#feedback')).toContainText('2/3');
});
test('정답 공개 중 시간 종료 시 다음 문제로 넘어가지 않고 재시작에 영향 없음',async({page})=>{
  await startFrozen(page);
  await page.clock.runFor(29000);
  for(let i=0;i<3;i++) await wrongTile(page);
  await expect(page.locator('.answer-reveal')).toHaveCount(1);
  await page.clock.runFor(1001);
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#score')).toHaveText('0점');
  await page.getByRole('button',{name:'다시 시작하기'}).click();
  const freshTile=await page.locator('.tile').first().elementHandle();
  await page.clock.runFor(1500);
  expect(await freshTile.evaluate(t=>t.isConnected)).toBe(true);
  await expect(page.locator('.answer-reveal')).toHaveCount(0);
  await wrongTile(page);
  await expect(page.locator('#feedback')).toContainText('1/3');
  await expect(page.locator('#overlay')).toBeHidden();
});

test('0.5초 보너스가 실제 종료 시점에 반영됨',async({page})=>{
  await startFrozen(page);
  for(let i=0;i<6;i++) await (await differentTile(page)).click();
  await expect(page.locator('#feedback')).toContainText('+0.5초');
  await expect(page.locator('#time')).toHaveText('33.5초');
  await page.clock.runFor(33000);
  await expect(page.locator('#time')).toHaveText('0.5초');
  await expect(page.locator('#overlay')).toBeHidden();
  await page.clock.runFor(500);
  await expect(page.locator('#time')).toHaveText('0초');
  await expect(page.locator('#overlay')).toBeVisible();
});
for(const width of [375,1440]){
  test(`시간 종료 후 마지막 정답이 결과에 가려지지 않음 (${width}px)`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await startFrozen(page);
    for(let i=0;i<4;i++) await (await differentTile(page)).click();
    const answer=await differentTile(page);
    const answerName=await answer.getAttribute('aria-label');
    const index=Number(answerName.match(/\d+/)[0])-1;
    await page.clock.runFor(30000);
    await expect(page.locator('.answer-reveal')).toHaveAttribute('aria-label',`${answerName}, 정답`);
    await expect(page.locator('#feedback')).toContainText(`${Math.floor(index/3)+1}행 ${index%3+1}열`);
    await expect(page.locator('#overlay')).toBeVisible();
    await expect(page.locator('#score')).toHaveText('4점');
    const board=await page.locator('#board').boundingBox();
    const result=await page.locator('#overlay').boundingBox();
    expect(result.y).toBeGreaterThanOrEqual(board.y+board.height);
    expect(await page.locator('.tile').evaluateAll(ts=>ts.every(t=>t.disabled))).toBe(true);
    await page.screenshot({path:`test-results/finished-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'다시 시작하기'}).click();
    await expect(page.locator('.answer-reveal')).toHaveCount(0);
    await expect(page.locator('#overlay')).toBeHidden();
    await expect(page.locator('#result-slot')).toBeEmpty();
    await (await differentTile(page)).click();
    await expect(page.locator('#score')).toHaveText('1점');
  });
}
