const $ = id => document.getElementById(id);
let best = 0;
try { const saved = Number(localStorage.getItem('color-pop-best')); if(Number.isFinite(saved) && saved > 0) best = Math.floor(saved); } catch {}
let score = 0, running = false, deadline = 0, interval;
function showBest(){ $('best').innerHTML = `${best}<span>점</span>`; $('side-best').innerHTML = `${best} <small>점</small>`; }
function updateTime(){
  const remaining = Math.max(0, deadline - performance.now());
  $('time').innerHTML = `${Math.ceil(remaining / 1000)}<span>초</span>`;
  $('timer-fill').style.width = `${remaining / 300}%`;
  $('timer-fill').classList.toggle('urgent',remaining < 8000);
  if(remaining === 0) finish();
}
function makeBoard(preview=false){
  const size = Math.min(6, 2 + Math.floor(score / 4));
  const hue = Math.floor(Math.random()*360), light = 43 + Math.random()*12;
  const difference = Math.max(7, 24 - score * .7);
  const answer = Math.floor(Math.random()*size*size);
  $('board').style.gridTemplateColumns = `repeat(${size},1fr)`;
  $('board').replaceChildren();
  for(let i=0;i<size*size;i++){
    const tile=document.createElement('button');
    tile.className='tile'; tile.type='button'; tile.setAttribute('aria-label',`${i+1}번 타일`);
    tile.style.backgroundColor=`hsl(${hue} 56% ${light + (i===answer ? difference : 0)}%)`;
    tile.disabled=preview;
    tile.addEventListener('click',()=>{
      if(!running) return;
      if(performance.now() >= deadline){updateTime(); return;}
      if(i===answer){
        score++; $('score').innerHTML=`${score}<span>점</span>`;
        $('level').textContent=`LEVEL ${String(score+1).padStart(2,'0')}`;
        $('feedback').textContent=['좋아요! 다음 색도 찾아볼까요?','정답! 색감이 빛나고 있어요 ✦','멋져요! 한 칸 더 앞으로!'][score%3];
        makeBoard();
      } else {
        $('feedback').textContent='아쉬워요! 다른 타일을 다시 골라보세요.';
        tile.animate([{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'translateX(0)'}],{duration:180,iterations:2});
      }
    });
    $('board').append(tile);
  }
}
function finish(){
  running=false; clearInterval(interval);
  document.querySelectorAll('.tile').forEach(t=>t.disabled=true);
  const record=score>best;
  if(record){best=score;try{localStorage.setItem('color-pop-best',String(best));}catch{}}
  showBest();
  $('overlay-title').textContent=record?'새로운 최고 기록! 🎉':'30초의 도전 완료!';
  $('overlay-copy').textContent=`${score}개의 다른 색을 찾았어요. 멋진 집중력이에요!`;
  $('start').innerHTML='다시 시작하기 <span>↗</span>';
  $('overlay-note').textContent='한 번 더, 새로운 색을 만나볼까요?';
  $('overlay').hidden=false;
  $('feedback').textContent='수고했어요! 잠깐 쉬었다 다시 도전해요.';
  $('start').focus();
}
$('start').addEventListener('click',()=>{
  score=0; running=true; deadline=performance.now()+30000;
  $('score').innerHTML='0<span>점</span>'; $('level').textContent='LEVEL 01';
  $('overlay').hidden=true; $('feedback').textContent='혼자 다른 색의 타일을 찾아주세요!';
  makeBoard(); updateTime(); clearInterval(interval); interval=setInterval(updateTime,100);
});
document.addEventListener('visibilitychange',()=>{if(running) updateTime();});
showBest(); makeBoard(true);
