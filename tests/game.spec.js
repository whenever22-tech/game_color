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
