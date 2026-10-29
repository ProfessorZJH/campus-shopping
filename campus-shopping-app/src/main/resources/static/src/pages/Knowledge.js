import BackofficeShell from '../components/BackofficeShell.js';
import {api,query} from '../services/api.js';
import {store,preview,notify,hasPermission} from '../services/store.js';
import {DEMO_BASES,DEMO_DOCS} from '../services/pages-demo.js';
import {label,dateTime,pathId} from '../services/page-utils.js';
const {ref,computed,onMounted,onUnmounted,watch}=Vue;
export default {
 name:'Knowledge',components:{BackofficeShell},setup(){
  const role=computed(()=>store.route.startsWith('/admin')?'admin':'merchant');const bases=ref([]),docs=ref([]),active=ref(''),selected=ref(null),text=ref('');
  const error=ref(''),busy=ref(false),newBase=ref(false),uploading=ref(false),baseName=ref(''),visibility=ref('PUBLIC'),title=ref(''),file=ref(null);
  const docPage=ref(1),docInfo=ref({total:0,hasNext:false});const versionRoot=ref(null);const current=computed(()=>bases.value.find(b=>b.id===active.value));
  let baseEpoch=0,docEpoch=0,readEpoch=0;
  const canRead=computed(()=>preview||(role.value==='admin'?store.workspace?.platformAdmin===true:hasPermission('knowledge.read')));
  const canManage=computed(()=>preview||(role.value==='admin'?store.workspace?.platformAdmin===true:hasPermission('knowledge.manage')));
  const context=(targetRole,targetMid)=>targetRole===role.value&&targetMid===store.merchantId;
  async function load(){
    const stamp=++baseEpoch, currentRole=role.value, mid=store.merchantId;
    ++docEpoch;++readEpoch;
    error.value='';bases.value=[];docs.value=[];selected.value=null;text.value='';
    // 平台知识库可直接访问 URL，不能根据 /admin 路径推断管理员身份。
    if(currentRole==='admin'&&!preview&&!store.workspace?.platformAdmin){
      try{
        const [user,workspace]=await Promise.all([api('/auth/me'),api('/workspace')]);
        if(stamp!==baseEpoch||!context(currentRole,mid))return;
        store.user=user;store.workspace=workspace;
      }catch(e){if(stamp===baseEpoch)error.value=e.message;return;}
    }
    if(!canRead.value){active.value='';return;}
    try{
      const result=preview?DEMO_BASES:await api('/knowledge/bases');
      if(stamp!==baseEpoch||!context(currentRole,mid))return;
      // Java 返回当前登录主体有权管理的全集，商户页面只呈现正在经营的商户。
      bases.value=(result||[]).filter(b=>currentRole==='admin'||b.merchantId===mid);
      if(!bases.value.some(b=>b.id===active.value))active.value=bases.value[0]?.id||'';
      docPage.value=1;
      await loadDocs();
    }catch(e){if(stamp===baseEpoch&&context(currentRole,mid))error.value=e.message;}
  }
  async function loadDocs(){
    const stamp=++docEpoch,id=active.value,page=docPage.value,currentRole=role.value,mid=store.merchantId;
    ++readEpoch;selected.value=null;text.value='';docs.value=[];
    if(!id){docInfo.value={total:0,hasNext:false};return;}
    const valid=()=>stamp===docEpoch&&active.value===id&&docPage.value===page&&context(currentRole,mid);
    try{
      const result=preview
        ? {items:DEMO_DOCS.filter(d=>d.baseId===id),total:DEMO_DOCS.filter(d=>d.baseId===id).length,hasNext:false}
        : await api('/knowledge/bases/'+pathId(id)+'/documents/page'+query({page,size:15}));
      if(!valid())return;
      docs.value=result.items||[];docInfo.value=result;
    }catch(e){if(valid())error.value=e.message;}
  }
  onMounted(load);onUnmounted(()=>{++baseEpoch;++docEpoch;++readEpoch;});
  watch([role,()=>store.merchantId,canRead,canManage],load);watch(docPage,loadDocs);
  async function read(d){
    const stamp=++readEpoch,id=active.value,mid=store.merchantId,currentRole=role.value;
    selected.value=d;text.value='';
    if(preview){text.value=d.content||'演示文档内容';return;}
    try{
      const result=await api('/knowledge/documents/'+pathId(d.id));
      if(stamp===readEpoch&&active.value===id&&selected.value?.id===d.id&&context(currentRole,mid)){
        text.value=result.content||'';selected.value=result;
      }
    }catch(e){if(stamp===readEpoch)notify(e.message);}
  }
  async function create(){if(preview||busy.value||!canManage.value||!baseName.value.trim())return;busy.value=true;try{await api('/knowledge/bases',{method:'POST',body:{merchantId:role.value==='admin'?null:store.merchantId,name:baseName.value.trim(),visibility:visibility.value}});newBase.value=false;baseName.value='';await load();notify('已创建知识库');}catch(e){notify(e.message);}finally{busy.value=false;}}
  function chooseFile(e){const selectedFile=e.target.files?.[0];file.value=null;if(!selectedFile)return;if(selectedFile.size>2*1024*1024){notify('文件不能超过2MB');e.target.value='';return;}if(!/\.(txt|md|pdf)$/i.test(selectedFile.name)){notify('仅支持 TXT、Markdown、文本 PDF');e.target.value='';return;}file.value=selectedFile;title.value=title.value||selectedFile.name;}
  async function toBase64(f){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(f);});}
  async function upload(){if(preview||busy.value||!canManage.value||!active.value||!file.value)return;busy.value=true;try{await api('/knowledge/bases/'+pathId(active.value)+'/documents',{method:'POST',body:{rootId:versionRoot.value,title:title.value.trim()||file.value.name,filename:file.value.name,contentType:file.value.type||(file.value.name.toLowerCase().endsWith('.pdf')?'application/pdf':'text/plain'),base64:await toBase64(file.value)}});uploading.value=false;file.value=null;title.value='';versionRoot.value=null;await loadDocs();notify('文档已上传');}catch(e){notify(e.message);}finally{busy.value=false;}}
  function newVersion(d){versionRoot.value=d.rootId;title.value=d.title;file.value=null;uploading.value=true;}
  function newDocument(){versionRoot.value=null;file.value=null;title.value='';uploading.value=!uploading.value;}
  async function action(d,operation){if(preview||busy.value||!canManage.value)return;busy.value=true;try{await api('/knowledge/documents/'+pathId(d.id)+'/'+operation,{method:'POST'});await loadDocs();notify('操作成功');}catch(e){notify(e.message);}finally{busy.value=false;}}
  return {role,canRead,canManage,bases,docs,active,selected,text,error,busy,newBase,uploading,baseName,visibility,title,file,current,preview,label,dateTime,read,load,loadDocs,docPage,docInfo,create,chooseFile,upload,action,newVersion,newDocument,versionRoot};
 },
 template:`<BackofficeShell :role="role" title="知识库"><template #actions><div v-if="canManage" class="head-actions"><button class="outline-button small" @click="newBase=!newBase" :disabled="!canManage"><Icon name="plus" :size="16"/>新建知识库</button><button class="teal-button" @click="newDocument" :disabled="!canManage||!active"><Icon name="plus" :size="17"/>上传文档</button></div></template><div v-if="error" class="inline-error">{{error}}</div><div v-if="canManage&&(newBase||uploading)" class="ops-grid kb-forms"><form v-if="newBase" class="ops-card ops-sideform" @submit.prevent="create"><h2>新建知识库</h2><label class="field-label">名称</label><input class="admin-input" v-model="baseName" maxlength="100" required/><label class="field-label">可见范围</label><select class="admin-input" v-model="visibility"><option value="PUBLIC">公开</option><option :value="role==='admin'?'PLATFORM_INTERNAL':'MERCHANT_INTERNAL'">内部</option></select><button class="teal-button" type="submit" :disabled="busy||preview">创建</button></form><form v-if="uploading" class="ops-card ops-sideform" @submit.prevent="upload"><h2>{{versionRoot?'上传新版本':'上传文档'}}</h2><label class="field-label">文档标题</label><input class="admin-input" v-model="title" maxlength="120" required/><label class="field-label">TXT / MD / 文本 PDF · 2MB 内</label><input class="admin-input" type="file" accept=".txt,.md,.pdf" @change="chooseFile" required/><button class="teal-button" type="submit" :disabled="busy||preview||!file">上传并索引</button></form></div>
 <div v-if="!canRead" class="ops-card access-denied">当前账号没有知识库查看权限。</div><div v-else class="knowledge-layout"><section class="ops-card kb-list"><div class="ops-card-header"><h2>知识库</h2><span>{{bases.length}}</span></div><button v-for="b in bases" :key="b.id" class="kb-base" :class="{active:active===b.id}" @click="active=b.id;docPage=1;loadDocs()"><span class="mini-icon"><Icon name="book"/></span><div><strong>{{b.name}}</strong><small>{{label(b.visibility)}}</small></div><Icon name="chevronRight" :size="16"/></button><div v-if="!bases.length" class="admin-empty">暂无知识库</div></section><section class="ops-card kb-docs"><div class="ops-card-header"><h2>{{current?.name||'文档'}}</h2><span>{{docs.length}} 项</span></div><div class="kb-doc" v-for="d in docs" :key="d.id" :class="{active:selected?.id===d.id}"><button @click="read(d)"><span class="mini-icon"><Icon name="clipboard"/></span><span><strong>{{d.title}}</strong><small>v{{d.version}} · {{dateTime(d.createdAt)}}</small></span></button><span class="status-tag" :class="d.status==='PUBLISHED'?'published':'draft'">{{label(d.status)}}</span><span class="kb-doc-actions" v-if="canManage"><button :disabled="busy||preview" @click="newVersion(d)" title="上传新版本" aria-label="上传新版本"><Icon name="plus" :size="15"/></button><button :disabled="busy||preview" @click="action(d,'index')" title="重建索引" aria-label="重建索引"><Icon name="refresh" :size="15"/></button><button :disabled="busy||preview||d.indexStatus!=='READY'||d.status==='PUBLISHED'" @click="action(d,'publish')" title="发布" aria-label="发布文档"><Icon name="check" :size="15"/></button><button :disabled="busy||preview||d.status!=='PUBLISHED'" @click="action(d,'withdraw')" title="撤回" aria-label="撤回文档"><Icon name="x" :size="15"/></button></span></div><div v-if="!docs.length" class="admin-empty">暂无文档</div><div class="sdd-pager" v-if="!preview&&docInfo.total>0"><span>{{docInfo.total}} 项</span><button :disabled="docPage<=1" @click="docPage--">上一页</button><span>{{docPage}}</span><button :disabled="!docInfo.hasNext" @click="docPage++">下一页</button></div></section><section class="ops-card kb-preview"><div class="ops-card-header"><h2>文档预览</h2><button v-if="selected" @click="selected=null;text=''" aria-label="关闭"><Icon name="x" :size="18"/></button></div><template v-if="selected"><div class="kb-title"><Icon name="book" :size="22"/><strong>{{selected.title}}</strong></div><div class="inspector-row"><span>版本</span><strong>v{{selected.version}}</strong></div><div class="inspector-row"><span>索引</span><strong>{{label(selected.indexStatus)}}</strong></div><div class="inspector-row"><span>状态</span><strong>{{label(selected.status)}}</strong></div><p v-if="selected.error" class="inline-error">{{selected.error}}</p><pre class="document-preview">{{text||'该版本暂无可显示的正文'}}</pre></template><div v-else class="admin-empty">选择文档查看</div></section></div></BackofficeShell>`
};
