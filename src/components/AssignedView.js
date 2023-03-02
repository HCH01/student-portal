import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import Loading from '../components/Loading';
import { auth, db, storage } from "../firebase/firebase";
import { showAlert } from "../features/alert/AlertSlice";
import { deleteObject, ref } from 'firebase/storage';
import DetailCard from './detailCard';
import { createSheet } from '../utils/writeExcel';
import { saveAs } from 'file-saver';

export default function AssignedView() {
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userProfile = useSelector(state => state.user.profile);
  const [assignment, setAssignment] = useState(null);
  const [completions, setCompletions] = useState(null);
  const [isAssignmentExists, setIsAssignmentExists] = useState(true);
  const deleteAssignmentModalCloseBtn = useRef(null);

  const timestamp = (time) => {
    const fireBaseTime = new Date(time.seconds * 1000 + time.nanoseconds / 1000000,);
    const date = fireBaseTime.toDateString();
    const atTime = fireBaseTime.toLocaleTimeString();
    return date + " - " + atTime;
  }

  const deleteAssignmentDoc = () => {
    const documentRef = doc(db, "department", userProfile.branch, "assignments", params.id);
    deleteDoc(documentRef).then(() => {
      deleteAssignmentModalCloseBtn.current.click();
      navigate('/');
    }).catch(() => {
      dispatch(showAlert({
        message: "Unable to delete this assignment.",
        type: "danger"
      }));
    });
  }

  const deleteAssigned = (e) => {
    if (assignment.attachment === null) {
      deleteAssignmentDoc();
    } else {
      let storageRef = null;

      if (assignment.attachmentType === 'img') {
        storageRef = ref(storage, `assignment/${params.id}/${auth.currentUser.uid}.png`);
      } else {
        storageRef = ref(storage, `assignment/${params.id}/${auth.currentUser.uid}.pdf`);
      }

      deleteObject(storageRef).then(() => {
        deleteAssignmentDoc();
      }).catch(() => {
        dispatch(showAlert({
          message: "Unable to delete this assignment.",
          type: "danger"
        }));
      });
    }
  }

  const downloadExcelSheet = (section) => {
    const sheetName = `${userProfile.branch}-${assignment.year}-${section}-sheet.xlsx`;
    const data = [];
    completions.forEach(e => {
      if (e.section === section) {
        data.push({
          rollno: e.rollno,
          name: e.name,
          section: e.section,
          submitted: timestamp(e.date)
        });
      }
    });
    const octet = createSheet(data, sheetName);
    saveAs(new Blob([octet], { type: "application/octet-stream" }), sheetName);
  }

  useEffect(() => {
    const fetchAssignment = async () => {
      const assignmentRef = doc(db, "department", userProfile.branch, "assignments", params.id);
      const assignmentSnap = await getDoc(assignmentRef);
      if (assignmentSnap.exists() && assignmentSnap.data().assignedBy === auth.currentUser.uid) {
        setAssignment(assignmentSnap.data());
      } else {
        setIsAssignmentExists(false);
      }
    }

    const fetchCompletions = async () => {
      const completedRef = collection(db, "department", userProfile.branch, "assignments", params.id, "completed");
      const completedQuery = query(completedRef, orderBy("rollno", "asc"), limit(100));
      const completedSnap = await getDocs(completedQuery);
      const completed = [];
      completedSnap.forEach((doc) => completed.push(doc.data()));
      setCompletions(completed);
    }

    if (userProfile !== null && (userProfile.role === "hod" || userProfile.role === "teacher") && assignment === null) {
      fetchAssignment();
    } else {
      setIsAssignmentExists(false);
    }
    if (assignment !== null && (assignment.type === "ASMT" || assignment.type === "ANMT" || assignment.type === "UNTT")) {
      fetchCompletions();
    }
  }, [assignment, setAssignment, params.id, userProfile]);

  return (
    <>
      {
        userProfile === null && <Loading />
      }
      {
        userProfile
        &&
        <>
          {
            assignment === null && isAssignmentExists && <Loading />
          }
          {
            assignment === null && !isAssignmentExists && <Loading message="This Assignment may be removed or not found." />
          }
          {
            assignment !== null
            &&
            <>
              <div className='container mt-5'>
                <h4>{assignment.type === "NOTS" ? "Notes" : assignment.type === "ASMT" ? "Assignment" : assignment.type === "UNTT" ? "Unit Test" : "Announcement"} | {assignment.subject}</h4>
                <span>{assignment.message}</span>
                <br />
                <br />
                <span>Assigned on - {timestamp(assignment.onDate)}</span>
                {
                  (assignment.type === "ASMT" || assignment.type === "ANMT" || assignment.type === "UNTT") &&
                  <>
                    <br />
                    <span>Submit on &nbsp;&nbsp;&nbsp;- {timestamp(assignment.outDate)}</span>
                  </>
                }
                <br />
                <br />

                {
                  assignment.attachment
                  &&
                  <>
                    <span><b>Attachment</b></span>
                    <div className="mt-3">
                      {
                        assignment.attachmentType === "img" &&
                        <img src={assignment.attachment} className="img-thumbnail" alt="attachment" />
                      }
                      {
                        assignment.attachmentType === "pdf" &&
                        <iframe title='PDF' src={assignment.attachment} className="w-100 vh-100"></iframe>
                      }
                    </div>
                  </>
                }

                {
                  (assignment.type === "ASMT" || assignment.type === "ANMT" || assignment.type === "UNTT") &&
                  <h6 className='mt-5'><b>Completed By - {assignment.branch.toUpperCase()} - {assignment.section.join(',')} - {assignment.year} year [{completions === null ? '0' : completions.length} Student]</b></h6>
                }

                {
                  completions && (assignment.type === "ASMT" || assignment.type === "ANMT" || assignment.type === "UNTT") &&
                  <div style={{ overflow: 'auto' }}>
                    {
                      completions.length !== 0 &&
                      <div className='d-flex my-3'>
                        {
                          assignment.section.includes('A') &&
                          <button type='button' className='btn btn-warning' onClick={(e) => downloadExcelSheet('A')}>Download Sheet Section A</button>
                        }
                        {
                          assignment.section.includes('B') &&
                          <button type='button' className='btn btn-warning ms-3' onClick={(e) => downloadExcelSheet('B')}>Download Sheet Section B</button>
                        }
                      </div>
                    }
                    <table className="table table-bordered">
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Name</th>
                          <th scope="col">Roll.no.</th>
                          <th scope="col">Section</th>
                          <th scope="col">Completed</th>
                          <th scope="col">file</th>
                        </tr>
                      </thead>
                      <tbody>
                        {
                          completions.map((e, i) => {
                            return (
                              <DetailCard key={e.uid} sno={i + 1} name={e.name} rollno={e.rollno} section={e.section} file={e.file} date={e.date} outDate={assignment.outDate} />
                            );
                          })
                        }
                      </tbody>
                    </table>
                  </div>
                }

              </div>
              <div className='container mt-5 d-flex flex-column align-items-end'>
                <button className="btn btn-danger mt-3 mb-5" type="button" data-bs-toggle="modal" data-bs-target="#delete-assgnmt">Remove Assignment</button>
              </div>

              <div className="modal fade" id="delete-assgnmt" tabIndex="-1" aria-labelledby="delete-assgnmt-label" aria-hidden="true">
                <div className="modal-dialog">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h1 className="modal-title fs-5" id="delete-assgnmt-label">Remove Assignment</h1>
                      <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body">
                      Are you sure to remove this assignment.
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" ref={deleteAssignmentModalCloseBtn}>Close</button>
                      <button type="button" className="btn btn-danger" onClick={deleteAssigned}>Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          }
        </>
      }
    </>
  )
}
