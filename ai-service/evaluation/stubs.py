"""原商品索引测试的受控替身；只作协议与故障验收。"""
class FakeEmbedding:
    model_tag='nvidia/nemotron-3.5-embed-1b'
    def __init__(self):self.calls=[]
    def embed(self,texts,input_type='passage'):
        self.calls.append((list(texts),input_type))
        return [[1.0,0.0,0.0] if '乌龙茶' in t or '茶饮' in t else [0.0,1.0,0.0] for t in texts]

class FakeMilvus:
    def __init__(self):self.collections={};self.created=[];self.searched=[]
    def has_collection(self,collection_name):return collection_name in self.collections
    def drop_collection(self,collection_name):del self.collections[collection_name]
    def create_collection(self,collection_name,dimension,**kwargs):
        self.created.append((collection_name,dimension,kwargs));self.collections[collection_name]={}
    def describe_collection(self,collection_name):return {'fields':[{'name':'vector','params':{'dim':'3'}}]}
    def query(self,collection_name,filter,output_fields,limit):
        return [{k:v for k,v in row.items() if k in output_fields} for row in self.collections[collection_name].values()]
    def upsert(self,collection_name,data):
        self.collections[collection_name].update({row['id']:row for row in data})
    def delete(self,collection_name,ids):
        for id in ids:self.collections[collection_name].pop(id,None)
    def search(self,collection_name,data,filter,limit,output_fields,consistency_level):
        self.searched.append((filter,consistency_level))
        q=data[0]
        rows=sorted(self.collections[collection_name].values(),key=lambda r:sum(a*b for a,b in zip(q,r['vector'])),reverse=True)
        return [[{'id':r['id'],'distance':1.0} for r in rows[:limit] if r['model'] in filter]]
