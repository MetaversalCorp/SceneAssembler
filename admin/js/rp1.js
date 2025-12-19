class ExtractMap extends MV.MVMF.NOTIFICATION
{
   #m_pFabric;
   #m_pLnG;
   #m_MapRMXItem;
   #m_wClass_Object;
   #m_twObjectIx;
   #pZone;

   #jPObject;
   #pRMXRoot;
   #pRMXPending;
   #bPending;
   #twObjectIx_PendingDelete;

   static eSTATE =
   {
      NOTREADY : 0,
      LOADING  : 1,
      READY    : 4
   };

   eSTATE = ExtractMap.eSTATE;
   constructor (jSelector, sURL, wClass_Object, twObjectIx, pLnGPrimary)
   {
      super ();

      this.jSelector = jSelector;

      this.#pZone = null;

      this.nStack = 0;
      this.#twObjectIx_PendingDelete = 0;

      this.#m_wClass_Object = (wClass_Object == 0) ? 71 : wClass_Object;
      this.#m_twObjectIx    = (twObjectIx == 0)  ? 1 : twObjectIx;

      this.xCollator = new Intl.Collator ();

      this.#m_MapRMXItem   = {};
      this.#pRMXRoot       = null;
      this.#bPending       = false;
      this.#pRMXPending    = null;

      this.#jPObject = this.jSelector.find ('.jsPObject');
      this.#jPObject.on ('change', this.onClick_Scene.bind (this));
      this.jSelector.find ('.jsPublish').on ('click', this.onClick_Publish.bind (this));
      this.jSelector.find ('.jsSceneAdd').on ('click', this.onClick_SceneAdd.bind (this));

      this.#m_pFabric = new MV.MVRP.MSF (sURL, MV.MVRP.MSF.eMETHOD.GET);
      this.#m_pFabric.Attach (this);
   }

   destructor ()
   {
      if (this.#m_pLnG)
      {
         for (let sItem in this.#m_MapRMXItem)
         {
            let Item = this.#m_MapRMXItem[sItem];

            Item.pRMXObject.Detach (this);
            this.#m_pLnG.Model_Close (Item.pRMXObject);
         }

         this.#m_pFabric.Detach (this);
         this.#m_pFabric.destructor ();

         this.#m_pFabric = null;
         this.#m_pLnG = null;
      }
   }

   onInserted (pNotice)
   {
      if (this.IsReady ())
      {
         let pChild = pNotice.pData.pChild;

         if (pChild && pChild.wClass_Object == 73 &&  pChild.twObjectIx == this.twObjectIx_Reparent)
         {
            this.nReparent--;
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

   UpdateEditor ()
   {
      let aEditor = [];

      this.ParseTree (aEditor, this.#pRMXRoot);

      const sResult = generateSceneJSONEx (JSON.stringify (aEditor, null, 2));

      setJSONEditorText (sResult);
      parseJSONAndUpdateScene (sResult);
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
               this.Exec ();
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
                     let sSelected = '';

                     if (i == 0)
                     {
                        this.#pRMXRoot = mpPObject[i];
                        sSelected = ' selected';
                     }

                     this.#jPObject.append ('<option value="' + mpPObject[i].twObjectIx + '"' + sSelected + '>' + mpPObject[i].pName.wsRMPObjectId + '</option>');
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
                     this.DisplayPanel ();
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
                  this.DisplayPanel ();
               }
            }
         }
      }
      else if (this.#pRMXPending && pNotice.pCreator.IsReady () && 
               pNotice.pCreator.wClass_Object == this.#pRMXPending.wClass_Object && pNotice.pCreator.twObjectIx == this.#pRMXPending.twObjectIx)
      {
         this.#bPending = false;
      }
      else if (pNotice.pCreator == this.#m_pLnG)
      {
         if (this.#m_pLnG.ReadyState () == this.#m_pLnG.eSTATE.LOGGEDIN)
         {
            this.DisplayPanel ();
         }
      }
   }

   Exec ()
   {
      let sID;

      if (this.#m_pLnG == null)
      {
         this.#m_pLnG = this.#m_pFabric.GetLnG ("map");
         this.#m_pLnG.Attach (this);

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

   onClick_Scene (e)
   {
      let jOption = this.#jPObject.find ("option:selected");
      let twObjectIx = jOption.val ();

      if (this.#m_MapRMXItem['73' + '-' + twObjectIx] == undefined)
      {
         this.#m_MapRMXItem['73' + '-' + twObjectIx] = this.#m_pLnG.Model_Open ('RMPObject', twObjectIx);
         this.#pRMXRoot = this.#m_MapRMXItem['73' + '-' + twObjectIx];
         this.#m_MapRMXItem['73' + '-' + twObjectIx].Attach (this);
      }
      else
      {
         this.#pRMXRoot = this.#m_MapRMXItem['73' + '-' + twObjectIx];
         this.UpdateScene ();
      } 
   }

   UpdateView ()
   {
   }

   RMCopy_Type (pJSON, pType, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pType)
      {
         pType.bType     = pJSON.pType.bType;   
         pType.bSubtype  = pJSON.pType.bSubtype;
         pType.bFiction  = pJSON.pType.bFiction;
         pType.bMovable  = pJSON.pType.bMovable;

         if (pRMPObjectSrc &&
             pRMPObjectSrc.pType.bType     == pType.bType    &&
             pRMPObjectSrc.pType.bSubtype  == pType.bSubtype &&
             pRMPObjectSrc.pType.bFiction  == pType.bFiction &&
             pRMPObjectSrc.pType.bMovable  == pType.bMovable
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Name (pJSON, pName, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.sName)
      {
         pName.wsRMPObjectId = pJSON.sName;

         if (pRMPObjectSrc &&
             pRMPObjectSrc.pName.wsRMPObjectId == pName.wsRMPObjectId
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Owner (pJSON, pOwner, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pOwner)
      {
         pOwner.twRPersonaIx = pJSON.pOwner.twRPersonaIx;

         if (pRMPObjectSrc &&
            pRMPObjectSrc.pOwner.twRPersonaIx == pOwner.twRPersonaIx
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Resource (pResourceSrc, pJSON, pResource, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pResource)
      {
         pResource.qwResource      = pResourceSrc.qwResource;
         pResource.sName           = pResourceSrc.sName;
         pResource.sReference      = pJSON.pResource.sReference;

         if (pRMPObjectSrc && 
             pRMPObjectSrc.pResource.qwResource == pResource.qwResource &&
             pRMPObjectSrc.pResource.sName      == pResource.sName &&
             pRMPObjectSrc.pResource.sReference == pResource.sReference
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Transform (pJSON, pTransform, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pTransform)
      {
         pTransform.vPosition.dX   = pJSON.pTransform.aPosition[0];
         pTransform.vPosition.dY   = pJSON.pTransform.aPosition[1];
         pTransform.vPosition.dZ   = pJSON.pTransform.aPosition[2];
                                 
         pTransform.qRotation.dX   = pJSON.pTransform.aRotation[0];
         pTransform.qRotation.dY   = pJSON.pTransform.aRotation[1];
         pTransform.qRotation.dZ   = pJSON.pTransform.aRotation[2];
         pTransform.qRotation.dW   = pJSON.pTransform.aRotation[3];
                                 
         pTransform.vScale.dX      = pJSON.pTransform.aScale[0];
         pTransform.vScale.dY      = pJSON.pTransform.aScale[1];
         pTransform.vScale.dZ      = pJSON.pTransform.aScale[2];

         if (pRMPObjectSrc &&
            pRMPObjectSrc.pTransform.vPosition.dX == pTransform.vPosition.dX &&
            pRMPObjectSrc.pTransform.vPosition.dY == pTransform.vPosition.dY &&
            pRMPObjectSrc.pTransform.vPosition.dZ == pTransform.vPosition.dZ &&
            pRMPObjectSrc.pTransform.qRotation.dX == pTransform.qRotation.dX &&
            pRMPObjectSrc.pTransform.qRotation.dY == pTransform.qRotation.dY &&
            pRMPObjectSrc.pTransform.qRotation.dZ == pTransform.qRotation.dZ &&
            pRMPObjectSrc.pTransform.qRotation.dW == pTransform.qRotation.dW &&
            pRMPObjectSrc.pTransform.vScale.dX    == pTransform.vScale.dX    &&
            pRMPObjectSrc.pTransform.vScale.dY    == pTransform.vScale.dY    &&
            pRMPObjectSrc.pTransform.vScale.dZ    == pTransform.vScale.dZ
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Bound (pJSON, pBound, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pTransform)
      {
         pBound.dX    = pJSON.aBound[0];
         pBound.dY    = pJSON.aBound[1];
         pBound.dZ    = pJSON.aBound[2];

         if (pRMPObjectSrc &&
            pRMPObjectSrc.pBound.dX == pBound.dX &&
            pRMPObjectSrc.pBound.dY == pBound.dY &&
            pRMPObjectSrc.pBound.dZ == pBound.dZ
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   onRSPEdit (pIAction, Param)
   {
      if (pIAction.pResponse.nResult == 0)
      {
      }
      else
      {
         this.nStack--;
         console.log ('ERROR: ' + pIAction.pResponse.nResult, pIAction);
      }
   }

   RMPEditType (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('TYPE');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Type (pRMPObjectJSON, Payload.pType, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditName (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('NAME');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Name (pRMPObjectJSON, Payload.pName, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditResource (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('RESOURCE');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Resource (pRMPObject.pResource, pRMPObjectJSON, Payload.pResource, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditBound (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('BOUND');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Bound (pRMPObjectJSON, Payload.pBound, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditTransform (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('TRANSFORM');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Transform (pRMPObjectJSON, Payload.pTransform, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditAll (pRMPObject, pJSON)
   {
      this.RMPEditName      (pRMPObject, pJSON);
      this.RMPEditResource  (pRMPObject, pJSON);
      this.RMPEditBound     (pRMPObject, pJSON);
      this.RMPEditTransform (pRMPObject, pJSON);
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

   async WaitForSingleObject (fnCond, interval)
   {
      return new Promise ((resolve) => {
         const check = () => {
            if (fnCond ())
            {
               resolve ();
            }
            else
            {
               setTimeout (check, interval);
            }
         };
         check ();
      })
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

   async RemoveRMPObject (mpRemovedNodes, pJSONObjectX)
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

      this.UpdateEditor ();

      this.jSelector.find ('.jsUnsaved').hide ();
      console.log ('Publish Complete!');
   }

   onClick_Publish (e)
   {
      this.jSelector.find ('.jsUnsaved').show ();
      this.onPublish ();
   }

   onClick_SceneAdd (e)
   {
      this.jSelector.find ('select option.jsNewScene').prop ('disabled', false);
   }

   onPublish ()
   {
      let sJSON = getJSONEditorText ();
      let pJSONObject = JSON.parse (sJSON);
      let pJSONObjectX = JSON.parse (sJSON);

      this.nStack = 0;
      if (pJSONObject[0].twObjectIx == this.#pRMXRoot.twObjectIx)
      {
         let mpRemovedNodes = {};

         this.GetRemovedNodes (pJSONObject[0], this.#pRMXRoot, mpRemovedNodes);
         this.UpdateRMPObject (pJSONObject[0], this.#m_MapRMXItem[this.#m_wClass_Object + '-' + this.#m_twObjectIx], mpRemovedNodes, pJSONObjectX[0]);
         this.RemoveRMPObject (mpRemovedNodes, pJSONObjectX[0]);
      }
      else
      {
         let mpRemovedNodes = {};

         this.UpdateRMPObject (pJSONObject[0], this.#m_MapRMXItem[this.#m_wClass_Object + '-' + this.#m_twObjectIx], mpRemovedNodes, pJSONObjectX[0]);
      }
   }

   DisplayPanel ()
   {
      let pData = 
      {
         sExpired : ';expires=Thu, 01 Jan 1970 00:00:01 GMT',
         sPath    : ';path=/',
         sZone    : '',
         sSameSite: ';samesite=strict'
      };

      if (this.#m_pLnG.ReadyState () == this.#m_pLnG.eSTATE.LOGGEDIN)
      {
         if (this.bLogin)
         {
            if (this.#pZone == null)
               this.#pZone = new MV.MVMF.COOKIE.ZONE (pData, 'Origin');
            this.#pZone.Set ('sKey', MV.MVMF.Escape (this.jSelector.find ('.jsKey').val ()));
         }

         this.jSelector.find ('.jsLogin').hide ();
         this.jSelector.find ('.jsSceneEditor').show ();
      }
      else
      {
         let sKey = null;

         if (this.#pZone == null)
         {
            this.#pZone = new MV.MVMF.COOKIE.ZONE (pData, 'Origin');

            sKey = this.#pZone.Get ('sKey');

            if (sKey != null)
               this.#m_pLnG.Login ('token=' + sKey );
         }

         if (sKey == null)
         {
            this.jSelector.find ('.jsLogin').show ();
            this.jSelector.find ('.jsSceneEditor').hide ();
         }
      }
   }

   onLogin (e)
   {
      e.preventDefault ();

      this.bLogin = true;
      this.#m_pLnG.Login ('token=' + MV.MVMF.Escape (this.jSelector.find ('.jsKey').val ()));
   }
};
