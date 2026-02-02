/*
** Copyright 2025 Metaversal Corporation.
**
** Licensed under the Apache License, Version 2.0 (the "License");
** you may not use this file except in compliance with the License.
** You may obtain a copy of the License at
**
**    https://www.apache.org/licenses/LICENSE-2.0
**
** Unless required by applicable law or agreed to in writing, software
** distributed under the License is distributed on an "AS IS" BASIS,
** WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
** See the License for the specific language governing permissions and
** limitations under the License.
**
** SPDX-License-Identifier: Apache-2.0
*/

class ExtractMap extends MapUtil
{
   #m_pFabric;
   #m_pLnG;
   #m_MapRMXItem;
   #m_wClass_Object;
   #m_twObjectIx;
   #pZone;
   #pLogin;
   #bIsObjectLibLoaded;

   #jBody;
   #jPObject;
   #pRMXRoot;
   #pRMXPending;
   #bPending;
   #twObjectIx_PendingDelete;
   #publishSuccessTimer;

   static eSTATE =
   {
      NOTREADY : 0,
      LOADING  : 1,
      READY    : 4
   };

   eSTATE = ExtractMap.eSTATE;
   constructor (jSelector, wClass_Object, twObjectIx)
   {
      let pData =
      {
         sExpired : ';expires=Thu, 01 Jan 1970 00:00:01 GMT',
         sPath    : ';path=/',
         sZone    : '',
         sSameSite: ';samesite=strict'
      };

      super ();

      this.#jBody = $('body');

      this.#bIsObjectLibLoaded = false;
      this.jSelector = jSelector;

      this.#pZone = new MV.MVMF.COOKIE.ZONE (pData, 'Origin');

      this.#twObjectIx_PendingDelete = 0;

      this.#m_wClass_Object = (wClass_Object == 0) ? 71 : wClass_Object;
      this.#m_twObjectIx    = (twObjectIx == 0)  ? 1 : twObjectIx;

      this.xCollator = new Intl.Collator ();

      this.#m_MapRMXItem   = {};
      this.#pRMXRoot       = null;
      this.#bPending       = false;
      this.#pRMXPending    = null;

      this.#jPObject = this.jSelector.find ('.jsSceneList');
      this.#jPObject.on ('click', '.jsSceneItem',    this.onClick_Scene.bind (this));
      this.#jPObject.on ('click', '.jsDeleteScene',  this.onClick_DeleteScene.bind (this));

      this.jSelector.find ('.jsPublish').on ('click', this.onClick_Publish.bind (this));
      this.jSelector.find ('.jsDisconnect').on ('click', this.onClick_Disconnect.bind (this));
      this.jSelector.find ('.jsNewScene').on ('click', this.onClick_AddScene.bind (this));
      this.jSelector.find ('.jsDeleteOk').on ('click', this.onClick_DeleteOk.bind (this));
      this.jSelector.find ('.jsDeleteCancel').on ('click', this.onClick_DeleteCancel.bind (this));

      this.#pLogin = {
         sUrl: this.#pZone.Get ('sUrl'),
         sKey: this.#pZone.Get ('sKey'),
         bLogin: true,
         bLoggedIn: false
      }

      if (this.#pLogin.sUrl && this.#pLogin.sKey)
      {
         this.#m_pFabric = new MV.MVRP.MSF (this.#pLogin.sUrl, MV.MVRP.MSF.eMETHOD.GET);
         this.#m_pFabric.Attach (this);
      }
      else
      {
         this.jSelector.find ('.jsLogin').show ();
         this.jSelector.find ('.jsSceneEditor').hide ();
         this.jSelector.find ('.jsUrl').val (window.location.origin + '/fabric/');

         this.#m_pFabric = null;
      }
   }

   destructor ()
   {
      if (this.#m_pLnG)
      {
         for (let sKey in this.#m_MapRMXItem)
         {
            this.#m_MapRMXItem[sKey].Detach (this);
            this.#m_pLnG.Model_Close (this.#m_MapRMXItem[sKey]);
         }
         this.#m_MapRMXItem = {};

         this.#m_pLnG.Detach (this);
         this.#m_pLnG = null;

         if (this.#m_pFabric)
         {
            this.#m_pFabric.Detach (this);
            this.#m_pFabric.destructor ();

            this.#m_pFabric = null;
         }
      }

      this.#pLogin = {
         sUrl: window.location.origin + '/fabric/fabric.msf',
         sKey: '',
         bLogin: true,
         bLoggedIn: false
      }

      this.#pZone.Remove ('sUrl');
      this.#pZone.Remove ('sKey');
   }

   StringToBase64 (str)
   {
      let encoded = btoa (encodeURIComponent (str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1)
        {
            return String.fromCharCode('0x' + p1);
        }));

      return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
   }

   Base64ToString (str)
   {
      let decoded = str.replace(/-/g, '+').replace(/_/g, '/');

      while (decoded.length % 4)
      {
         decoded += '=';
      }

      return decodeURIComponent (atob(decoded).split('').map
         (
            function(c)
            {
               return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }
         ).join (''));
   }

   InsertSceneItem (pRMCObject, bSelected)
   {
      let jTemplate = this.#jBody.find ('template#tmpl_scene');
      let jItem = $(jTemplate[0].content.querySelector ('.jsSceneItem'));

      jItem = jItem.clone ();

      jItem.data ('object', pRMCObject);
      jItem.attr ('twObjectIx', pRMCObject.twObjectIx);

      if (bSelected)
      {
         jItem.addClass ('active');
         this.#jBody.find ('.jsCurrentScene').text (pRMCObject.pName.wsRMPObjectId);
      }

      this.#jPObject.append (jItem);

      jItem.find ('.jsSceneItemName').text (pRMCObject.pName.wsRMPObjectId);
   }

   onInserted (pNotice)
   {
      if (this.IsReady ())
      {
         let pChild = pNotice.pData.pChild;

         if (pChild)
         {
            if (pChild.wClass_Object == 73 &&  pChild.twObjectIx == this.twObjectIx_Reparent)
            {
               this.nReparent--;
            }

            if (pChild.wClass_Parent == 70 && pChild.wClass_Object == 73)
            {
               this.InsertSceneItem (pChild, true);
            }
         }
      }
   }

   onUpdated (pNotice)
   {
      if (this.IsReady ())
      {
         if (pNotice.pData.pChild == null)
         {
            this.nStack--;
         }
      }
   }

   onChanged (pNotice)
   {
      this.onUpdated (pNotice);
   }

   onDeleting (pNotice)
   {
      if (this.IsReady ())
      {
         let pChild = pNotice.pData.pChild;

         if (pChild && pChild.wClass_Object == 73)
         {
            if (pChild.twObjectIx == this.twObjectIx_Reparent)
               this.nReparent--;
            else if (pChild.twObjectIx == this.#twObjectIx_PendingDelete)
               this.#twObjectIx_PendingDelete = 0;

            if (pChild.wClass_Parent == 70)
            {
               this.#jPObject.find ('.jsSceneItem[twObjectIx=' + pChild.twObjectIx + ']').remove ();
// TODO: finish this
            }
         }
      }
   }

   EnumItem (pRMXObject, Param)
   {
      Param.push (pRMXObject);
   }

   EnumRoot (pRMXObject, Param)
   {
      Param.push (pRMXObject);
   }

   FindInsertItem (Item, pRMXObject)
   {
      let Result = null;

      if (Item.twObjectIx == pRMXObject.twObjectIx || Item.twObjectIx == pRMXObject.twParentIx)
         Result = Item;
      else
      {
         for (let n=0; n < Item.aChildren.length && (Result = this.FindInsertItem (Item.aChildren[n], pRMXObject)) == null; n++);
      }

      return Result;
   }

   PObjectToJSON (pRMXObject, bRoot)
   {
      let Result = {
         twObjectIx:    pRMXObject.twObjectIx,
         wClass:        pRMXObject.wClass_Object,
         sName:         pRMXObject.pName.wsRMPObjectId,
         pTransform:    {
            aPosition: [
               pRMXObject.pTransform.vPosition.dX,
               pRMXObject.pTransform.vPosition.dY,
               pRMXObject.pTransform.vPosition.dZ
            ],
            aRotation: [
               pRMXObject.pTransform.qRotation.dX,
               pRMXObject.pTransform.qRotation.dY,
               pRMXObject.pTransform.qRotation.dZ,
               pRMXObject.pTransform.qRotation.dW
            ],
            aScale: [
               pRMXObject.pTransform.vScale.dX,
               pRMXObject.pTransform.vScale.dY,
               pRMXObject.pTransform.vScale.dZ
            ],
         },
         aBound: [
            pRMXObject.pBound.dX,
            pRMXObject.pBound.dY,
            pRMXObject.pBound.dZ
         ],
         aChildren:     []
      };

      if (bRoot == false)
      {
         Result.pResource = {
            sReference:    pRMXObject.pResource.sReference
         };
      }

      return Result;
   }

   ParseTree (aEditor, pRMXObject)
   {
      let Node = this.PObjectToJSON (pRMXObject, (pRMXObject.wClass_Parent == 70));
      let apRMXObject = [];

      aEditor.push (Node);

      pRMXObject.Child_Enum ('RMPObject', this, this.EnumItem, apRMXObject);

      for (let n=0; n < apRMXObject.length; n++)
         this.ParseTree (Node.aChildren, apRMXObject[n]);
   }

   UpdateEditor (clearHistory = true)
   {
      let aEditor = [];

      if (this.#pRMXRoot)
         this.ParseTree (aEditor, this.#pRMXRoot);
      else
      {
         aEditor.push
         (
            {
               "sName": "<New Scene>",
               "pTransform": {
                  "aPosition": [0, 0, 0],
                  "aRotation": [0, 0, 0, 1],
                  "aScale": [1, 1, 1]
               },
               "aBound": [150, 150, 150],
               "aChildren": [
               ],
               "wClass": 73,
               "twObjectIx": 0
            }
         );
      }

      const sResult = generateSceneJSONEx (JSON.stringify (aEditor, null, 2));

      loadScene (sResult, clearHistory);
   }

   UpdateScene ()
   {
      let bDone = true;
      for (let sKey in this.#m_MapRMXItem)
      {
         if (this.#m_MapRMXItem[sKey].IsReady () == false)
            bDone = false;
      }

      if (bDone)
      {
         this.UpdateEditor ();

         this.ReadyState (this.eSTATE.READY);
         this.UpdateAttachmentPointUrl ();
      }
   }

   IsReady ()
   {
      return this.ReadyState () == this.eSTATE.READY;
   }

   onReadyState (pNotice)
   {
      if (this.IsReady () == false)
      {
         if (pNotice.pCreator == this.#m_pFabric)
         {
            if (this.#m_pFabric.IsReady ())
            {
               this.#m_pLnG = this.#m_pFabric.GetLnG ("map");
               this.#m_pLnG.Attach (this);
            }
            else if (this.#m_pFabric.ReadyState () == this.#m_pFabric.eSTATE.ERROR)
            {
               console.log ('Error Loading Fabric File.');
            }
         }
         else if (pNotice.pCreator == this.#m_pLnG)
         {
            if (this.#m_pLnG.ReadyState () == this.#m_pLnG.eSTATE.LOGGEDIN)
            {
               this.SaveLogin ();
            }
            else if (this.#m_pLnG.ReadyState () == this.#m_pLnG.eSTATE.LOGGEDOUT)
            {
               this.Login ();
            }
         }
         else if (pNotice.pCreator.IsReady ())
         {
            if (this.ReadyState () == this.eSTATE.NOTREADY)
            {
               if (pNotice.pCreator.wClass_Object == 70) // RMRoot
               {
                  let mpPObject = [];

                  pNotice.pCreator.Child_Enum ('RMPObject', this, this.EnumRoot, mpPObject);

                  for (let i=0; i < mpPObject.length; i++)
                  {
                     let bSelected = false;

                     if (i == 0)
                     {
                        this.#pRMXRoot = mpPObject[i];
                        bSelected = true;
                     }

                     this.InsertSceneItem (mpPObject[i], bSelected);
                  }

                  if (this.#pRMXRoot)
                  {
                     this.#m_MapRMXItem[this.#pRMXRoot.wClass_Object + '-' + this.#pRMXRoot.twObjectIx] = this.#pRMXRoot;
                     this.ReadyState (this.eSTATE.LOADING); // Loading Children
                     this.#pRMXRoot.Attach (this);
                  }
                  else
                  {
                     this.ReadyState (this.eSTATE.READY); // No Scenes
                  }
               }
            }
            else if (this.ReadyState () == this.eSTATE.LOADING)
            {
               if (pNotice.pCreator.wClass_Object == 73)
               {
                  let aPObject = [];
                  pNotice.pCreator.Child_Enum ('RMPObject', this, this.EnumItem, aPObject);

                  for (let i=0; i < aPObject.length; i++)
                  {
                     if (this.#m_MapRMXItem['73' + '-' + aPObject[i].twObjectIx] == undefined)
                     {
                        this.#m_MapRMXItem['73' + '-' + aPObject[i].twObjectIx] = aPObject[i];
                        aPObject[i].Attach (this);
                     }
                     else
                     {
                        // Do Nothing as we have already fetched the data for this object
                     }
                  }

                  this.UpdateScene ();
               }
            }
         }
      }
      else if (this.#pRMXPending && pNotice.pCreator.IsReady () &&
               pNotice.pCreator.wClass_Object == this.#pRMXPending.wClass_Object && pNotice.pCreator.twObjectIx == this.#pRMXPending.twObjectIx)
      {
         this.#bPending = false;
      }
   }

   UpdateView ()
   {
   }

   onRSPOpen (pIAction, Param)
   {
      if (pIAction.pResponse.nResult == 0)
      {
         this.#pRMXPending = this.#m_pLnG.Model_Open ('RMPObject', pIAction.pResponse.aResultSet[0][0].twRMPObjectIx);
         this.#m_MapRMXItem['73' + '-' + pIAction.pResponse.aResultSet[0][0].twRMPObjectIx] = this.#pRMXPending;

         this.#pRMXPending.Attach (this);
      }
      else
      {
         console.log ('ERROR: Creating Object - ' + pIAction.pResponse.nResult);

         this.#pRMXPending = null;
         this.#bPending = false;
      }
   }

   onRSPParent (pIAction, Param)
   {
      if (pIAction.pResponse.nResult == 0)
      {
         console.log ('SUCCESS: Parent');
      }
      else
      {
         console.log ('ERROR: Parent - ' + pIAction.pResponse.nResult);

         this.twObjectIx_Reparent = 0;
         this.nReparent = 0;
      }
   }

   CheckPending ()
   {
      return !this.#bPending; // True means stop, False continues
   }

   CheckParent ()
   {
      return (this.nReparent <= 0); // True means stop, False continues
   }

   CheckStack ()
   {
      return (this.nStack <= 0); // True means stop, False continues
   }

   CheckClose ()
   {
      return (this.#twObjectIx_PendingDelete == 0); // True means stop, False continues
   }

   EnumNodes (pRMXObject, Param)
   {
      Param.push (pRMXObject);
   }

   GetRemovedNodes (pJSONObject, pRMXObject, mpRemovedNodes)
   {
      let apRMXObject = [];
      let pJSONObjectX;

      pRMXObject.Child_Enum ('RMPObject', this, this.EnumNodes, apRMXObject);

      for (let n=0; n < apRMXObject.length; n++)
      {
         let i;

         if (pJSONObject)
         {
            for (i=0; i < pJSONObject.aChildren.length && pJSONObject.aChildren[i].twObjectIx != apRMXObject[n].twObjectIx; i++);

            if (i < pJSONObject.aChildren.length)
            {
               pJSONObjectX = pJSONObject.aChildren[i];
            }
            else
            {
               mpRemovedNodes[apRMXObject[n].twObjectIx] = apRMXObject[n];
               pJSONObjectX = null;
            }
         }
         else
         {
            mpRemovedNodes[apRMXObject[n].twObjectIx] = apRMXObject[n];
            pJSONObjectX = null;
         }

         this.GetRemovedNodes (pJSONObjectX, apRMXObject[n], mpRemovedNodes);
      }
   }

   onRSPClose (pIAction, Param)
   {
      if (pIAction.pResponse.nResult == 0)
      {
      }
      else
      {
         this.#twObjectIx_PendingDelete = 0;
         console.log ('ERROR: ' + pIAction.pResponse.nResult, pIAction);
      }
   }

   async UpdateRMPObject (pJSONObject, pRMXObject_Parent, mpRemovedNodes, pJSONObjectX)
   {
      if (pJSONObject)
      {
         const qc = [pJSONObject];
         pJSONObjectX.pRMPObject = pRMXObject_Parent;
         const qcX = [pJSONObjectX];

         while (qc.length > 0)
         {
            const JSONItem = qc.shift ();
            const JSONItemX = qcX.shift ();
            let pRMPObject;

            pRMXObject_Parent = JSONItemX.pRMPObject;

            // Process Item
            if (JSONItem.twObjectIx)
            {
               pRMPObject = this.#m_MapRMXItem['73' + '-' + JSONItem.twObjectIx];

               if (pRMPObject)
               {
                  this.RMPEditAll (pRMPObject, JSONItem);

                   console.log ('Edit (WAITING)...');
                  await this.WaitForSingleObject (this.CheckStack.bind (this), 125);
                  console.log ('Edit (READY)');

                  if (mpRemovedNodes[JSONItem.twObjectIx])
                  {
                     let pIAction = pRMPObject.Request ('PARENT');
                     let Payload = pIAction.pRequest;

                     Payload.wClass       = pRMXObject_Parent.wClass_Object;
                     Payload.twObjectIx   = pRMXObject_Parent.twObjectIx;

                     this.nReparent = 2;
                     this.nStack++;
                     this.twObjectIx_Reparent = pRMPObject.twObjectIx;

                     console.log ('Waiting on Parent.... ' + pRMXObject_Parent.twObjectIx);
                     pIAction.Send (this, this.onRSPParent.bind (this));
                     await this.WaitForSingleObject (this.CheckParent.bind (this), 125);
                     console.log ('Parent Waiting complete....');

                     this.nStack--;

                     delete mpRemovedNodes[JSONItem.twObjectIx];
                  }
               }
               else console.log ('ERROR: twObjectIx (' + JSONItem.twObjectIx + ') not found!');
            }
            else
            {
               let pIAction = pRMXObject_Parent.Request ('RMPOBJECT_OPEN');
               let Payload = pIAction.pRequest;

               if (this.RMCopy_Name (JSONItem, Payload.pName) &&
                     this.RMCopy_Type ({ pType: { bType: 1, bSubtype: 0, bFiction: 0, bMovable: 0 } }, Payload.pType) &&
                     this.RMCopy_Owner ({ pOwner: { twRPersonaIx: 1 } }, Payload.pOwner) &&
                     this.RMCopy_Resource ({ qwResource: 0, sName: ''}, JSONItem, Payload.pResource) &&
                     this.RMCopy_Bound (JSONItem, Payload.pBound) &&
                     this.RMCopy_Transform (JSONItem, Payload.pTransform))
               {
                  this.#bPending = true;
                  this.nStack++;

                  console.log ('Waiting on Add To.... ' + pRMXObject_Parent.twObjectIx);
                  pIAction.Send (this, this.onRSPOpen.bind (this));
                  await this.WaitForSingleObject (this.CheckPending.bind (this), 125);
                  console.log ('Waiting on Add To Complete.... ' + pRMXObject_Parent.twObjectIx);

                  this.nStack--;
                  pRMPObject = this.#pRMXPending;

                  if (this.#pRMXRoot == null)
                     this.#pRMXRoot = this.#pRMXPending;
               }
               else
               {
                  pRMPObject = null;
                  console.log ('ERROR: twObjectIx (' + JSONItem.twObjectIx + ') has invalid data!!!');
               }
            }

            JSONItemX.bProcessed = true;

            for (let n=0; n < JSONItem.aChildren.length; n++)
            {
               qc.push (JSONItem.aChildren[n]);
               JSONItemX.aChildren[n].pRMPObject = pRMPObject;
               qcX.push (JSONItemX.aChildren[n]);
            }
         }
      }

      return true;
   }

   CheckJSONXEx (pJSONObjectX)
   {
      let bResult = true;

      if (pJSONObjectX.bProcessed)
      {
         for (let i=0; i < pJSONObjectX.aChildren.length && bResult; i++)
            bResult = this.CheckJSONXEx (pJSONObjectX.aChildren[i]);
      }
      else bResult = false;

      return bResult;
   }

   CheckJSONX (pJSONObjectX)
   {
      return this.CheckJSONXEx (pJSONObjectX); // True means stop, False continues
   }

   EnumDelete (pRMXObject, Param)
   {
      let i;

      for (i=0; i < Param.aNodes.length && Param.aNodes[i].twObjectIx != pRMXObject.twObjectIx; i++);
      if (i == Param.aNodes.length)
         Param.bDelete = false;

      return Param.bDelete;
   }

   async RemoveRMPObject (mpRemovedNodes, pJSONObjectX, bSelectItem)
   {
      console.log ('Update (waiting)...');
      await this.WaitForSingleObject (this.CheckJSONX.bind (this, pJSONObjectX), 125);
      console.log ('Update (Completed)');

      let aNodes = [];
      let i;
      while (Object.keys (mpRemovedNodes).length > 0)
      {
         for (let twObjectIx in mpRemovedNodes)
         {
            let Param = {
               aNodes: aNodes,
               bDelete: true
            };

            if (mpRemovedNodes[twObjectIx].nChildren > 0)
            {
               mpRemovedNodes[twObjectIx].Child_Enum ('RMPObject', this, this.EnumDelete, Param);
            }

            if (Param.bDelete)
            {
               aNodes.push (mpRemovedNodes[twObjectIx]);
               delete mpRemovedNodes[twObjectIx];
            }
         }
      }

      for (i=0; i < aNodes.length; i++)
      {
         aNodes[i].Detach (this);

         let pRMXObject_Parent = this.#m_MapRMXItem[aNodes[i].wClass_Parent + '-' + aNodes[i].twParentIx];

         let pIAction = pRMXObject_Parent.Request ('RMPOBJECT_CLOSE');
         let Payload = pIAction.pRequest;

         Payload.twRMPObjectIx_Close = aNodes[i].twObjectIx;
         Payload.bDeleteAll             = 0;

         this.#twObjectIx_PendingDelete = aNodes[i].twObjectIx;
         pIAction.Send (this, this.onRSPClose);

         console.log ('Waiting for Close... ' + pRMXObject_Parent.twObjectIx + ' => ' + aNodes[i].twObjectIx);
         await this.WaitForSingleObject (this.CheckClose.bind (this), 125);
         console.log ('Waiting Complete...(close)');

         delete this.#m_MapRMXItem['73' + '-' + aNodes[i].twObjectIx];
      }

      // Refresh scene without clearing undo/redo history after publishing
      this.UpdateEditor (false);

      this.jSelector.find ('.jsUnsaved').hide ();
      console.log ('Publish Complete!');
      this.showPublishSuccess ();

//      if (bSelectItem)
      {
         this.#jPObject.find ('.jsSceneItem[twObjectIx=' + this.#pRMXRoot.twObjectIx + ']')
            .addClass ('active')
            .find ('.jsSceneItemName').text (this.#pRMXRoot.pName.wsRMPObjectId);

         this.#jBody.find ('.jsCurrentScene').text (this.#pRMXRoot.pName.wsRMPObjectId);
      }

      this.UpdateAttachmentPointUrl ();
   }

   async #CreateRMPObject (pRMXObject_Parent, pJSONObject, pJSONObjectX)
   {
      let pIAction = pRMXObject_Parent.Request ('RMPOBJECT_OPEN');
      let Payload = pIAction.pRequest;

      let pResource = {
         qwResource: 0,
         sName:      pJSONObject[0].sName,
         sReference: ''
      };

      this.RMCopy_Name (pJSONObject[0], Payload.pName);
      this.RMCopy_Type ({ pType: { bType: 1, bSubtype: 0, bFiction: 0, bMovable: 0 } }, Payload.pType);
      // Use the current UserIx
      this.RMCopy_Owner ({ pOwner: { twRPersonaIx: 1 } }, Payload.pOwner);
      this.RMCopy_Resource ({ qwResource: 0, sName: ''}, pResource, Payload.pResource);
      this.RMCopy_Bound (pJSONObject[0], Payload.pBound);
      this.RMCopy_Transform (pJSONObject[0], Payload.pTransform);

      this.#bPending = true;
      this.nStack++;

      console.log ('Waiting on Add To.... ' + pRMXObject_Parent.twObjectIx);
      pIAction.Send (this, this.onRSPOpen.bind (this));
      await this.WaitForSingleObject (this.CheckPending.bind (this), 125);
      console.log ('Waiting on Add To Complete.... ' + pRMXObject_Parent.twObjectIx);

      this.nStack--;

      if (this.#pRMXPending != null)
      {
         pJSONObject[0].twObjectIx = this.#pRMXPending.twObjectIx;

         if (this.#pRMXRoot == null)
         {
            this.#pRMXRoot = this.#pRMXPending;

            let mpRemovedNodes = {};
            this.UpdateRMPObject (pJSONObject[0], this.#m_MapRMXItem[this.#m_wClass_Object + '-' + this.#m_twObjectIx], mpRemovedNodes, pJSONObjectX[0]);
            this.RemoveRMPObject (mpRemovedNodes, pJSONObjectX[0], true);
         }
      }
   }

   onClick_Scene (e)
   {
      let jItem = $(e.currentTarget).closest ('.jsSceneItem');
      let pRMCObject = jItem.data ('object');
      let twObjectIx = pRMCObject.twObjectIx;

      // Check if the clicked scene is already the active scene
      if (this.#pRMXRoot && this.#pRMXRoot.twObjectIx === twObjectIx)
      {
         // Scene is already active, just close the offcanvas panel
         const sceneManagerPanel = document.getElementById('sceneManagerPanel');
         if (sceneManagerPanel)
         {
            const bsOffcanvas = bootstrap.Offcanvas.getInstance(sceneManagerPanel);
            if (bsOffcanvas)
            {
               bsOffcanvas.hide();
            }
         }
         return;
      }

      if (this.#m_MapRMXItem['73' + '-' + twObjectIx] == undefined)
      {
         this.#m_MapRMXItem['73' + '-' + twObjectIx] = this.#m_pLnG.Model_Open ('RMPObject', twObjectIx);
         this.#pRMXRoot = this.#m_MapRMXItem['73' + '-' + twObjectIx];
         this.ReadyState (this.eSTATE.LOADING); // Loading Children
         this.#m_MapRMXItem['73' + '-' + twObjectIx].Attach (this);
      }
      else
      {
         this.#pRMXRoot = this.#m_MapRMXItem['73' + '-' + twObjectIx];
         this.UpdateScene ();
      }

      this.#jPObject.find ('.jsSceneItem').removeClass ('active');
      jItem.addClass ('active');

      this.#jBody.find ('.jsCurrentScene').text (pRMCObject.pName.wsRMPObjectId);
      this.UpdateAttachmentPointUrl ();
   }

   onClick_AddScene (e)
   {
      this.#jPObject.find ('.jsSceneItem').removeClass ('active');
      this.#jBody.find ('.jsCurrentScene').text ('<New Scene>');

      this.#pRMXRoot = null;
      this.UpdateEditor ();
      this.UpdateAttachmentPointUrl ();
   }

   onClick_DeleteScene (e)
   {
      let jItem = $(e.currentTarget).closest ('.jsSceneItem');
      let pRMCObject = jItem.data ('object');

      this.pTmpDelete = pRMCObject;
      ShowDeleteWarning (pRMCObject.pName.wsRMPObjectId);

      e.stopPropagation ();
   }

   onRSPClose2 (pIAction, Param)
   {
      if (pIAction.pResponse.nResult == 0)
      {
      }
      else
      {
         console.log ('ERROR: ' + pIAction.pResponse.nResult, pIAction);
      }

      DismissDeleteWarning ();
   }

   onClick_DeleteOk (e)
   {
      let pIAction = this.#m_MapRMXItem[this.#m_wClass_Object + '-' + this.#m_twObjectIx].Request ('RMPOBJECT_CLOSE');
      let Payload = pIAction.pRequest;

      Payload.twRMPObjectIx_Close = this.pTmpDelete.twObjectIx;
      Payload.bDeleteAll    = 1;

      pIAction.Send (this, this.onRSPClose2.bind (this));
   }

   onClick_DeleteCancel (e)
   {
      const modalElement = document.getElementById ('deleteChangesModal');
      const modal = bootstrap.Modal.getInstance (modalElement);

      if (modal)
         modal.hide();
   }

   showPublishSuccess ()
   {
      const jPublish = this.jSelector.find ('.jsPublish');
      if (!jPublish.length) return;

      jPublish
         .removeClass ('nav-link pe-3')
         .addClass ('btn btn-success px-2 py-1 opacity-100')
         .prop ('disabled', true)
         .html ('<i class="fa-solid fa-cloud fa-beat"></i> <small>Scene Published</small>');

      if (this.#publishSuccessTimer) clearTimeout (this.#publishSuccessTimer);
      this.#publishSuccessTimer = setTimeout (() => {
         this.#publishSuccessTimer = null;
         jPublish
            .removeClass ('btn btn-success px-2 py-1 opacity-100')
            .addClass ('nav-link pe-3')
            .prop ('disabled', false)
            .html ('<i class="fa-solid fa-cloud-arrow-up"></i>')
            .attr ('title', 'Publish Scene');
      }, 3500);
   }

   onClick_Publish (e)
   {
      this.jSelector.find ('.jsUnsaved').show ();
      this.onPublish ();
   }

   onClick_Disconnect (e)
   {
      this.destructor ();

      this.#bIsObjectLibLoaded = false;
      this.ReadyState (this.eSTATE.NOTREADY);

      this.jSelector.find ('.jsLogin').show ();
      this.jSelector.find ('.jsSceneEditor').hide ();
      this.#jPObject.html ('');
   }

   onPublish ()
   {
      let sJSON = getJSONEditorText ();
      let pJSONObject = JSON.parse (sJSON);
      let pJSONObjectX = JSON.parse (sJSON);

      this.nStack = 0;
      if (this.#pRMXRoot && pJSONObject[0].twObjectIx == this.#pRMXRoot.twObjectIx)
      {
         let mpRemovedNodes = {};

         this.GetRemovedNodes (pJSONObject[0], this.#pRMXRoot, mpRemovedNodes);
         this.UpdateRMPObject (pJSONObject[0], this.#m_MapRMXItem[this.#m_wClass_Object + '-' + this.#m_twObjectIx], mpRemovedNodes, pJSONObjectX[0]);
         this.RemoveRMPObject (mpRemovedNodes, pJSONObjectX[0], false);
      }
      else
      {
         this.#CreateRMPObject (this.#m_MapRMXItem[this.#m_wClass_Object + '-' + this.#m_twObjectIx], pJSONObject, pJSONObjectX);
      }
   }

   SaveLogin ()
   {
      if (this.#pLogin.bLoggedIn == false)
      {
         let pData =
         {
            sExpired : ';expires=Thu, 01 Jan 1970 00:00:01 GMT',
            sPath    : ';path=/',
            sZone    : '',
            sSameSite: ';samesite=strict'
         };
         let sID;

         this.#pLogin.bLoggedIn = true;

         this.#pZone.Set ('sKey', this.#pLogin.sKey);
         this.#pZone.Set ('sUrl', this.#pLogin.sUrl);

         this.jSelector.find ('.jsLogin').hide ();
         this.jSelector.find ('.jsSceneEditor').show ();
         this.UpdateAttachmentPointUrl ();

         if (this.#m_wClass_Object == 70)
            sID = 'RMRoot';
         else if (this.#m_wClass_Object == 71)
            sID = 'RMCObject';
         else if (this.#m_wClass_Object == 72)
            sID = 'RMTObject';
         else if (this.#m_wClass_Object == 73)
            sID = 'RMPObject';

         this.#m_MapRMXItem[this.#m_wClass_Object + '-' + this.#m_twObjectIx] = this.#m_pLnG.Model_Open (sID, this.#m_twObjectIx);
         this.#m_MapRMXItem[this.#m_wClass_Object + '-' + this.#m_twObjectIx].Attach (this);
      }
   }

   Login ()
   {
      if (this.#pLogin.bLogin)
      {
         this.#pLogin.bLogin = false;
         this.#m_pLnG.Login ('token=' + MV.MVMF.Escape (this.#pLogin.sKey));
      }
      else
      {
         setTimeout (this.onLoginFailure.bind (this), 0);
      }
   }

   onLoginFailure ()
   {
      this.#m_pFabric.Detach (this);
      this.#m_pFabric.destructor ();
      this.#m_pFabric = null;
   }

   onLogin (e)
   {
      e.preventDefault ();

      this.#pLogin = {
         sKey: this.jSelector.find ('.jsKey').val (),
         sUrl: this.jSelector.find ('.jsUrl').val (),
         bLogin: true,
         bLoggedIn: false
      };

      if (this.#pLogin.sUrl != '')
      {
         this.#m_pFabric = new MV.MVRP.MSF (this.#pLogin.sUrl, MV.MVRP.MSF.eMETHOD.GET);
         this.#m_pFabric.Attach (this);
      }
   }

   LoadObjectLibrary ()
   {
      if (this.#bIsObjectLibLoaded == false)
      {
         loadObjectLibrary (this.GetRootUrl ());
         this.#bIsObjectLibLoaded = true;
      }
   }

   UpdateAttachmentPointUrl ()
   {
      let sUrl = '';

      if (this.#m_pFabric)
      {
         const sRootUrl = this.GetRootUrl ();
         const wClass = this.#pRMXRoot?.wClass_Object;
         const twObjectIx = this.#pRMXRoot?.twObjectIx;

         // Only generate the URL if the scene has been published at least once
         // (i.e., it exists in Fabric and has a non-zero twObjectIx).
         if (sRootUrl && wClass && twObjectIx && twObjectIx > 0)
         {
            sUrl = sRootUrl + 'fabric/' + wClass + '/' + twObjectIx;
         }
      }

      document.dispatchEvent (new CustomEvent ('attachment-point-url', { detail: { url: sUrl } }));
   }

   GetRootUrl ()
   {
      let sResult = this.#m_pFabric.pMSF_Map.sRootUrl;

      if (sResult.length > 0)
      {
         let c = sResult.slice (-1);
         if (c != '/')
            sResult += '/';
      }

      return sResult;
   }
};
